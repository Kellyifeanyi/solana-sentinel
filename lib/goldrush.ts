import { buildRecommendations, calculateRiskScore, riskLevel } from "@/lib/risk-engine";
import { configuredWatchlistAddresses } from "@/lib/watchlist/auto-watchlist";
import type {
  AlertKind,
  AlertFeed,
  RiskLevel,
  RiskSignals,
  SentinelAlert,
  SuspiciousToken,
  WalletBalance,
  WalletReport,
  WalletTransaction,
} from "@/types/sentinel";

const CHAIN = "solana-mainnet";
const BASE_URL = "https://api.covalenthq.com/v1";
const REQUEST_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 60_000;
const DEFAULT_WATCHLIST: string[] = [];

type FetchState = "fresh" | "stale" | "fallback";

type GoldRushEnvelope<T> = {
  data?: T;
  error?: boolean;
  error_message?: string;
  error_code?: number;
};

type GoldRushBalanceItem = {
  contract_ticker_symbol?: string | null;
  contract_name?: string | null;
  contract_decimals?: number | null;
  balance?: string | null;
  quote?: number | null;
  balance_quote?: number | null;
  quote_rate?: number | null;
  quote_rate_24h?: number | null;
  logo_url?: string | null;
};

type GoldRushTransactionItem = {
  tx_hash?: string | null;
  block_signed_at?: string | null;
  successful?: boolean | null;
  value_quote?: number | null;
  from_address?: string | null;
  to_address?: string | null;
  fees_paid?: string | null;
  gas_quote?: number | null;
  pretty_value_quote?: string | null;
  log_events?: Array<{
    sender_contract_ticker_symbol?: string | null;
    sender_name?: string | null;
    sender_address?: string | null;
    decoded?: { name?: string | null } | null;
  }> | null;
};

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

const responseCache = new Map<string, CacheEntry<unknown>>();

class GoldRushRateLimitError extends Error {
  retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("GoldRush rate limit exceeded");
    this.retryAfterMs = retryAfterMs;
  }
}

function getApiKey() {
  return process.env.GOLDRUSH_API_KEY?.trim();
}

function buildUrl(path: string) {
  return `${BASE_URL}/${path.replace(/^\/+/, "")}`;
}

function getCached<T>(key: string, maxAgeMs: number): T | null {
  const entry = responseCache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.timestamp > maxAgeMs) return null;
  return entry.value;
}

function setCached<T>(key: string, value: T) {
  responseCache.set(key, { value, timestamp: Date.now() });
}

function retryDelay(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 4000) : 900;
}

async function goldrushFetch<T>(path: string): Promise<{ data: T | null; state: FetchState; reason?: string }> {
  const apiKey = getApiKey();
  const url = buildUrl(path);
  const cached = getCached<T>(url, CACHE_TTL_MS);
  if (cached) return { data: cached, state: "fresh" };

  if (!apiKey) {
    return { data: null, state: "fallback", reason: "missing_api_key" };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429) {
        throw new GoldRushRateLimitError(retryDelay(response));
      }

      if (!response.ok) {
        return {
          data: null,
          state: "fallback",
          reason: `http_${response.status}`,
        };
      }

      const payload = (await response.json()) as GoldRushEnvelope<T>;
      if (payload.error) {
        return {
          data: null,
          state: "fallback",
          reason: payload.error_message ?? "goldrush_error",
        };
      }

      if (payload.data) {
        setCached(url, payload.data);
        return { data: payload.data, state: "fresh" };
      }
    } catch (error) {
      if (error instanceof GoldRushRateLimitError && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs));
        continue;
      }

      return {
        data: null,
        state: error instanceof GoldRushRateLimitError ? "stale" : "fallback",
        reason: error instanceof GoldRushRateLimitError ? "rate_limited" : "request_failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { data: null, state: "stale", reason: "rate_limited" };
}

function scaledAmount(rawBalance?: string | null, decimals?: number | null) {
  const raw = Number(rawBalance ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw / 10 ** Number(decimals ?? 0);
}

function tokenRisk(valueUsd: number, concentration: number, change24h: number): RiskLevel {
  if (concentration > 45 || Math.abs(change24h) > 30) return "high";
  if (concentration > 20 || valueUsd < 25) return "moderate";
  return "low";
}

function transactionRisk(amountUsd: number, successful?: boolean | null): RiskLevel {
  if (successful === false) return "high";
  if (amountUsd >= 1_000_000) return "critical";
  if (amountUsd >= 250_000) return "high";
  if (amountUsd >= 50_000) return "moderate";
  return "low";
}

function inferTransactionType(item: GoldRushTransactionItem): WalletTransaction["type"] {
  const decodedNames = item.log_events?.map((event) => event.decoded?.name?.toLowerCase() ?? "").join(" ") ?? "";
  if (decodedNames.includes("swap")) return "swap";
  if (decodedNames.includes("mint")) return "mint";
  if (decodedNames.includes("burn")) return "burn";
  if (decodedNames.includes("bridge")) return "bridge";
  return "transfer";
}

function inferTransactionToken(item: GoldRushTransactionItem) {
  return item.log_events?.find((event) => event.sender_contract_ticker_symbol)?.sender_contract_ticker_symbol ?? "UNKNOWN";
}

function normalizeBalances(items: GoldRushBalanceItem[] = []): WalletBalance[] {
  const positiveItems = items
    .map((item) => {
      const valueUsd = Number(item.quote ?? item.balance_quote ?? 0);
      const symbol = item.contract_ticker_symbol?.trim() || "UNKNOWN";
      const change24h = Number(item.quote_rate_24h ?? 0);
      return {
        item,
        valueUsd: Number.isFinite(valueUsd) ? valueUsd : 0,
        symbol,
        change24h: Number.isFinite(change24h) ? change24h : 0,
      };
    })
    .filter(({ valueUsd, symbol }) => valueUsd > 0 || symbol !== "UNKNOWN")
    .sort((a, b) => b.valueUsd - a.valueUsd);

  const knownItems = positiveItems.filter(({ symbol }) => symbol.toUpperCase() !== "UNKNOWN");
  const unknownItems = positiveItems.filter(({ symbol }) => symbol.toUpperCase() === "UNKNOWN");
  const unknownValue = unknownItems.reduce((sum, { valueUsd }) => sum + valueUsd, 0);
  const unknownAmount = unknownItems.reduce((sum, { item }) => sum + scaledAmount(item.balance, item.contract_decimals), 0);
  const groupedItems = [
    ...knownItems,
    ...(unknownItems.length
      ? [{
        item: {
          contract_name: unknownItems.length === 1 ? "Unknown asset" : "Unknown assets",
          contract_ticker_symbol: "UNKNOWN",
          balance: String(unknownAmount),
          contract_decimals: 0,
        },
        valueUsd: unknownValue,
        symbol: "UNKNOWN",
        change24h: 0,
      }]
      : []),
  ].sort((a, b) => b.valueUsd - a.valueUsd);

  const total = groupedItems.reduce((sum, { valueUsd }) => sum + valueUsd, 0);

  return groupedItems.slice(0, 12).map(({ item, valueUsd, symbol, change24h }) => {
    const concentration = total > 0 ? Math.round((valueUsd / total) * 100) : 0;
    return {
      symbol,
      name: item.contract_name?.trim() || symbol,
      amount: scaledAmount(item.balance, item.contract_decimals),
      valueUsd,
      change24h,
      concentration,
      risk: tokenRisk(valueUsd, concentration, change24h),
    };
  });
}

function transactionDirection(item: GoldRushTransactionItem, address: string): WalletTransaction["direction"] {
  const normalizedAddress = address.toLowerCase();
  const from = item.from_address?.toLowerCase();
  const to = item.to_address?.toLowerCase();

  if (from === normalizedAddress && to === normalizedAddress) return "self";
  if (from === normalizedAddress) return "outbound";
  if (to === normalizedAddress) return "inbound";
  return "unknown";
}

function normalizeTransactions(items: GoldRushTransactionItem[] = [], address: string): WalletTransaction[] {
  return items.flatMap((item) => {
    if (!item.tx_hash || !item.block_signed_at) return [];
    const amountUsd = Number(item.value_quote ?? item.gas_quote ?? 0);
    const normalizedAmount = Number.isFinite(amountUsd) ? Math.max(amountUsd, 0) : 0;
    return [{
      id: item.tx_hash,
      type: inferTransactionType(item),
      token: inferTransactionToken(item),
      amountUsd: normalizedAmount,
      counterparty: item.to_address ?? item.from_address ?? "unknown",
      fromAddress: item.from_address ?? undefined,
      toAddress: item.to_address ?? undefined,
      direction: transactionDirection(item, address),
      timestamp: item.block_signed_at,
      risk: transactionRisk(normalizedAmount, item.successful),
    }];
  }).slice(0, 20);
}

function watchlistAddresses() {
  const configured = configuredWatchlistAddresses();
  return configured.length ? configured : DEFAULT_WATCHLIST;
}

function alertKind(type: WalletTransaction["type"], risk: RiskLevel): AlertKind {
  if (risk === "critical" || risk === "high") return "suspicious_movement";
  if (type === "swap") return "dex_activity";
  return "large_transfer";
}

function venueLabel(type: WalletTransaction["type"]) {
  const labels: Record<WalletTransaction["type"], string> = {
    transfer: "Native transfer",
    swap: "DEX route",
    mint: "Token mint",
    burn: "Token burn",
    bridge: "Bridge movement",
  };
  return labels[type];
}

function percentileScore(value: number, highWater: number) {
  if (highWater <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / highWater) * 100)));
}

function severityRank(severity: RiskLevel) {
  return { critical: 4, high: 3, moderate: 2, low: 1 }[severity];
}

function alertKindRank(kind: AlertKind) {
  const ranks: Record<AlertKind, number> = {
    accumulation_burst: 7,
    dex_activity_spike: 6,
    suspicious_transfer_surge: 6,
    suspicious_movement: 4,
    dex_activity: 3,
    large_transfer: 2,
  };
  return ranks[kind];
}

function transactionAlertKind(transaction: WalletTransaction, walletTransactions: WalletTransaction[]): AlertKind {
  const recentSimilar = walletTransactions.filter((tx) => tx.type === transaction.type).length;
  if (transaction.risk === "critical" && transaction.type === "transfer") return "suspicious_transfer_surge";
  if (transaction.type === "swap" && recentSimilar >= 2) return "dex_activity_spike";
  if (transaction.type === "transfer" && transaction.amountUsd >= 100_000) return "accumulation_burst";
  return alertKind(transaction.type, transaction.risk);
}

function titleForTransactionAlert(kind: AlertKind) {
  const titles: Record<AlertKind, string> = {
    accumulation_burst: "Large Transfer",
    dex_activity_spike: "DEX Activity Spike",
    suspicious_transfer_surge: "High-Value Transfer",
    suspicious_movement: "High-Risk Transaction",
    dex_activity: "DEX Activity Detected",
    large_transfer: "Large Transfer Detected",
  };
  return titles[kind];
}

function sortBreakingAlerts(alerts: SentinelAlert[]) {
  return [...alerts].sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta) return severityDelta;

    const kindDelta = alertKindRank(b.kind) - alertKindRank(a.kind);
    if (kindDelta) return kindDelta;

    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function buildRiskSignals(balances: WalletBalance[], transactions: WalletTransaction[]): RiskSignals {
  const totalValue = balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const largestPosition = balances[0]?.concentration ?? 0;
  const highRiskTxCount = transactions.filter((tx) => tx.risk === "high" || tx.risk === "critical").length;
  const totalTxVolume = transactions.reduce((sum, tx) => sum + tx.amountUsd, 0);
  const suspiciousTokens: SuspiciousToken[] = [];
  const highValueIndicators = [
    totalValue >= 1_000_000 ? `Visible GoldRush balance value is $${Math.round(totalValue).toLocaleString()}.` : null,
    totalTxVolume >= 500_000 ? `Tracked GoldRush transaction notional totals $${Math.round(totalTxVolume).toLocaleString()}.` : null,
    highRiskTxCount > 0 ? `${highRiskTxCount} tracked transaction${highRiskTxCount === 1 ? "" : "s"} crossed elevated notional or failed-execution thresholds.` : null,
    largestPosition >= 40 ? `${balances[0]?.symbol ?? "Largest visible asset"} is ${largestPosition}% of visible GoldRush balance value.` : null,
  ].filter(Boolean) as string[];

  return {
    suspiciousTokens,
    concentrationScore: Math.min(100, largestPosition * 1.5),
    transferBehaviorScore: Math.min(100, highRiskTxCount * 22 + percentileScore(totalTxVolume, 2_500_000) * 0.35),
    volatilityExposureScore: Math.min(100, balances.filter((balance) => Math.abs(balance.change24h) > 15 || balance.risk === "high").length * 24),
    transactionFrequencyScore: Math.min(100, transactions.length * 6),
    highValueIndicators,
  };
}

export async function getWalletBalances(address: string): Promise<{ data: WalletBalance[]; source: "goldrush" | "fallback"; reason?: string }> {
  const result = await goldrushFetch<{ items?: GoldRushBalanceItem[] }>(`${CHAIN}/address/${encodeURIComponent(address)}/balances_v2/`);
  const balances = result.data ? normalizeBalances(result.data.items) : [];

  return {
    data: balances,
    source: result.state === "fresh" ? "goldrush" : "fallback",
    reason: result.reason,
  };
}

export async function getWalletTransactions(address: string): Promise<{ data: WalletTransaction[]; source: "goldrush" | "fallback"; reason?: string }> {
  const result = await goldrushFetch<{ items?: GoldRushTransactionItem[] }>(
    `${CHAIN}/address/${encodeURIComponent(address)}/transactions_v3/page/0/`,
  );

  const transactions = result.data ? normalizeTransactions(result.data.items, address) : [];

  return {
    data: transactions,
    source: result.state === "fresh" ? "goldrush" : "fallback",
    reason: result.reason,
  };
}

export async function getWalletTokenExposure(address: string) {
  const { data } = await getWalletBalances(address);
  return data.map(({ symbol, valueUsd, concentration, risk }) => ({ symbol, valueUsd, concentration, risk }));
}

export async function getWalletRiskSignals(address: string): Promise<RiskSignals> {
  const [balances, transactions] = await Promise.all([getWalletBalances(address), getWalletTransactions(address)]);
  return buildRiskSignals(balances.data, transactions.data);
}

export async function getWalletReport(address: string): Promise<WalletReport> {
  const [balanceResult, transactionResult] = await Promise.all([getWalletBalances(address), getWalletTransactions(address)]);
  const signals = buildRiskSignals(balanceResult.data, transactionResult.data);
  const score = calculateRiskScore(balanceResult.data, transactionResult.data, signals);

  return {
    address,
    balances: balanceResult.data,
    transactions: transactionResult.data,
    signals,
    score,
    level: riskLevel(score),
    recommendations: buildRecommendations(score, signals),
    source: balanceResult.source === "goldrush" || transactionResult.source === "goldrush" ? "goldrush" : "fallback",
  };
}

async function getGoldRushWalletSnapshot(address: string) {
  const [balanceResult, transactionResult] = await Promise.all([getWalletBalances(address), getWalletTransactions(address)]);

  if (transactionResult.source !== "goldrush" && balanceResult.source !== "goldrush") {
    return null;
  }

  return {
    address,
    balances: balanceResult.source === "goldrush" ? balanceResult.data : [],
    transactions: transactionResult.source === "goldrush" ? transactionResult.data : [],
    reason: transactionResult.reason ?? balanceResult.reason,
  };
}

function buildTransactionAlert(address: string, transaction: WalletTransaction, walletTransactions: WalletTransaction[]): SentinelAlert {
  const kind = transactionAlertKind(transaction, walletTransactions);

  return {
    id: transaction.id,
    kind,
    wallet: address,
    token: transaction.token,
    amountUsd: transaction.amountUsd,
    venue: venueLabel(transaction.type),
    timestamp: transaction.timestamp,
    severity: transaction.risk,
    title: titleForTransactionAlert(kind),
    summary: `${transaction.token} ${transaction.type} for ${transaction.amountUsd >= 1 ? `$${Math.round(transaction.amountUsd).toLocaleString()}` : "unpriced notional"}.`,
    reason:
      transaction.risk === "critical" || transaction.risk === "high"
        ? `${transaction.type} transaction met ${transaction.risk} risk threshold from GoldRush amount and execution status.`
        : `${transaction.type} transaction is present in the GoldRush watchlist response.`,
    sourceLabel: "GoldRush transactions",
    group: kind === "dex_activity_spike" || kind === "dex_activity" ? "DEX activity" : "Wallet activity",
  };
}

export async function getLiveAlertFeed(): Promise<AlertFeed> {
  const addresses = watchlistAddresses().slice(0, 6);
  if (!addresses.length) {
    return { alerts: [], source: "empty", reason: "no_watchlist_configured" };
  }

  const snapshots = (await Promise.all(addresses.map((address) => getGoldRushWalletSnapshot(address)))).filter(Boolean) as Array<
    NonNullable<Awaited<ReturnType<typeof getGoldRushWalletSnapshot>>>
  >;

  if (!snapshots.length) {
    return {
      alerts: [],
      source: "empty",
      reason: "goldrush_unavailable",
    };
  }

  const alerts = sortBreakingAlerts([
    ...snapshots.flatMap((snapshot) =>
      snapshot.transactions
        .filter((transaction) => transaction.risk === "moderate" || transaction.risk === "high" || transaction.risk === "critical" || transaction.type === "swap")
        .slice(0, 5)
        .map((transaction) => buildTransactionAlert(snapshot.address, transaction, snapshot.transactions)),
    ),
  ].filter(Boolean) as SentinelAlert[])
    .slice(0, 12);

  return {
    alerts,
    source: "goldrush",
  };
}

export async function getLiveAlerts() {
  return (await getLiveAlertFeed()).alerts;
}
