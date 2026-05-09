import { detectAutoWhales } from "@/lib/discovery/auto-whale-detection";
import type { RecentActivityCandidate } from "@/lib/discovery/activity-scanner";
import { detectWhaleEmergence } from "@/lib/intelligence/whale-emergence";
import { buildRecommendations, calculateRiskScore, riskLevel } from "@/lib/risk-engine";
import { buildAutoWatchlist, configuredWatchlistAddresses } from "@/lib/watchlist/auto-watchlist";
import type {
  AlertKind,
  AlertFeed,
  AutoWatchlistEntry,
  RiskLevel,
  RiskSignals,
  SuspiciousToken,
  WalletBalance,
  WalletReport,
  WalletTransaction,
  WhaleAlert,
} from "@/types/sentinel";

const CHAIN = "solana-mainnet";
const BASE_URL = "https://api.covalenthq.com/v1";
const REQUEST_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 10 * 60_000;
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

type GoldRushBlockItem = {
  height?: number | string | null;
  block_height?: number | string | null;
  block_signed_at?: string | null;
  signed_at?: string | null;
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
    return { data: getCached<T>(url, STALE_TTL_MS), state: "fallback", reason: "missing_api_key" };
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
          data: getCached<T>(url, STALE_TTL_MS),
          state: "fallback",
          reason: `http_${response.status}`,
        };
      }

      const payload = (await response.json()) as GoldRushEnvelope<T>;
      if (payload.error) {
        return {
          data: getCached<T>(url, STALE_TTL_MS),
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
        data: getCached<T>(url, STALE_TTL_MS),
        state: error instanceof GoldRushRateLimitError ? "stale" : "fallback",
        reason: error instanceof GoldRushRateLimitError ? "rate_limited" : "request_failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { data: getCached<T>(url, STALE_TTL_MS), state: "stale", reason: "rate_limited" };
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

  const total = positiveItems.reduce((sum, { valueUsd }) => sum + valueUsd, 0);

  return positiveItems.slice(0, 12).map(({ item, valueUsd, symbol, change24h }) => {
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

function normalizeTransactions(items: GoldRushTransactionItem[] = []): WalletTransaction[] {
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
    whale_emergence: 8,
    accumulation_burst: 7,
    dex_activity_spike: 6,
    risk_profile_changed: 5,
    new_watchlist_wallet: 5,
    activity_cluster_burst: 6,
    dormant_to_active: 5,
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
    whale_emergence: "Whale Emergence Detected",
    accumulation_burst: "Large Accumulation Burst",
    dex_activity_spike: "Sudden DEX Activity Spike",
    risk_profile_changed: "Risk Profile Changed",
    new_watchlist_wallet: "New Wallet Enters Watchlist",
    activity_cluster_burst: "Activity Cluster Burst",
    dormant_to_active: "Wallet Goes From Dormant to Active",
    suspicious_transfer_surge: "Suspicious Transfer Surge",
    suspicious_movement: "Suspicious Transfer Surge",
    dex_activity: "DEX Activity Detected",
    large_transfer: "Large Transfer Detected",
  };
  return titles[kind];
}

function sortBreakingAlerts(alerts: WhaleAlert[]) {
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
  const repeatedElevatedTokenActivity = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.token === "UNKNOWN") continue;
    if (transaction.risk === "high" || transaction.risk === "critical") {
      repeatedElevatedTokenActivity.set(transaction.token, (repeatedElevatedTokenActivity.get(transaction.token) ?? 0) + 1);
    }
  }

  const suspiciousTokens: SuspiciousToken[] = balances
    .filter((balance) => balance.concentration >= 45 || (repeatedElevatedTokenActivity.get(balance.symbol) ?? 0) >= 2)
    .slice(0, 5)
    .map((balance) => {
      const elevatedCount = repeatedElevatedTokenActivity.get(balance.symbol) ?? 0;
      const evidence = [
        balance.concentration >= 45 ? `${balance.symbol} represents ${balance.concentration}% of visible GoldRush balance value.` : null,
        elevatedCount >= 2 ? `${elevatedCount} elevated-notional tracked transactions reference ${balance.symbol}.` : null,
      ].filter(Boolean) as string[];

      return {
        symbol: balance.symbol,
        reason: evidence.join(" "),
        severity: balance.concentration >= 60 || elevatedCount >= 4 ? "high" : "moderate",
        exposureUsd: balance.valueUsd,
        confidence: evidence.length >= 2 ? "high" : "moderate",
        evidence,
      };
    });

  const whaleIndicators = [
    totalValue >= 1_000_000 ? "Portfolio value exceeds common Solana whale monitoring thresholds" : null,
    totalTxVolume >= 500_000 ? "Recent transaction notional indicates institutional-sized activity" : null,
    highRiskTxCount > 0 ? `${highRiskTxCount} tracked transactions crossed elevated notional or failed-execution thresholds` : null,
    largestPosition >= 40 ? "Portfolio is materially concentrated in a single asset" : null,
  ].filter(Boolean) as string[];

  return {
    suspiciousTokens,
    concentrationScore: Math.min(100, largestPosition * 1.5),
    transferBehaviorScore: Math.min(100, highRiskTxCount * 22 + percentileScore(totalTxVolume, 2_500_000) * 0.35),
    volatilityExposureScore: Math.min(100, balances.filter((balance) => Math.abs(balance.change24h) > 15 || balance.risk === "high").length * 24),
    transactionFrequencyScore: Math.min(100, transactions.length * 6),
    whaleIndicators,
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

  const transactions = result.data ? normalizeTransactions(result.data.items) : [];

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

function extractLatestBlockHeight(data: { items?: GoldRushBlockItem[] } | GoldRushBlockItem | null) {
  const item = Array.isArray((data as { items?: GoldRushBlockItem[] } | null)?.items)
    ? (data as { items?: GoldRushBlockItem[] }).items?.[0]
    : (data as GoldRushBlockItem | null);
  const height = Number(item?.height ?? item?.block_height);
  return Number.isFinite(height) && height > 0 ? Math.floor(height) : null;
}

function activityCandidatesFromTransactions(items: GoldRushTransactionItem[] = []) {
  const grouped = new Map<string, WalletTransaction[]>();

  for (const item of items) {
    const from = item.from_address?.trim();
    const to = item.to_address?.trim();
    const timestamp = item.block_signed_at;
    if (!timestamp) continue;
    const baseAmount = Number(item.value_quote ?? item.gas_quote ?? 0);
    const amountUsd = Number.isFinite(baseAmount) ? Math.max(baseAmount, 0) : 0;
    const type = inferTransactionType(item);
    const token = inferTransactionToken(item);

    for (const [address, counterparty] of [
      [from, to],
      [to, from],
    ] as Array<[string | undefined, string | undefined]>) {
      if (!address) continue;
      const transactions = grouped.get(address) ?? [];
      transactions.push({
        id: item.tx_hash ?? `discovery-${address}-${transactions.length}`,
        type,
        token,
        amountUsd,
        counterparty: counterparty ?? "unknown",
        timestamp,
        risk: transactionRisk(amountUsd, item.successful),
      });
      grouped.set(address, transactions);
    }
  }

  return Array.from(grouped.entries()).map(
    ([address, transactions]): RecentActivityCandidate => ({
      address,
      transactions,
    }),
  );
}

async function getRecentGoldRushActivityCandidates(): Promise<{ candidates: RecentActivityCandidate[]; reason?: string }> {
  const configuredHeight = Number(process.env.SENTINEL_DISCOVERY_BLOCK_HEIGHT);
  let latestHeight = Number.isFinite(configuredHeight) && configuredHeight > 0 ? Math.floor(configuredHeight) : null;

  if (!latestHeight) {
    const latestBlock = await goldrushFetch<{ items?: GoldRushBlockItem[] } | GoldRushBlockItem>(`${CHAIN}/block_v2/latest/`);
    latestHeight = extractLatestBlockHeight(latestBlock.data);
    if (!latestHeight) return { candidates: [], reason: latestBlock.reason ?? "goldrush_latest_block_unavailable" };
  }

  const blockHeights = [latestHeight, latestHeight - 1, latestHeight - 2].filter((height) => height > 0);
  const blockResults = await Promise.all(
    blockHeights.map((height) => goldrushFetch<{ items?: GoldRushTransactionItem[] }>(`${CHAIN}/block/${height}/transactions_v3/`)),
  );

  const items = blockResults.flatMap((result) => result.data?.items ?? []);
  if (!items.length) {
    return {
      candidates: [],
      reason: blockResults.find((result) => result.reason)?.reason ?? "goldrush_block_transactions_unavailable",
    };
  }

  return { candidates: activityCandidatesFromTransactions(items) };
}

function emergenceSeverity(score: number): RiskLevel {
  if (score >= 86) return "critical";
  if (score >= 70) return "high";
  if (score >= 52) return "moderate";
  return "low";
}

function buildEmergenceAlert(snapshot: NonNullable<Awaited<ReturnType<typeof getGoldRushWalletSnapshot>>>): WhaleAlert | null {
  const emergence = detectWhaleEmergence(snapshot);
  if (emergence.emergenceScore < 34) return null;

  const latestTimestamp = snapshot.transactions[0]?.timestamp;
  if (!latestTimestamp) return null;
  const topSignal = [...emergence.signals].sort((a, b) => b.weight - a.weight)[0];
  const totalValue = snapshot.balances.reduce((sum, balance) => sum + balance.valueUsd, 0);

  return {
    id: `emergence-${snapshot.address}-${latestTimestamp}`,
    kind: emergence.stage === "waking up" ? "dormant_to_active" : "whale_emergence",
    wallet: snapshot.address,
    token: snapshot.balances[0]?.symbol ?? snapshot.transactions[0]?.token ?? "SOL",
    amountUsd: totalValue,
    venue: "GoldRush intelligence",
    timestamp: latestTimestamp,
    severity: emergenceSeverity(emergence.emergenceScore),
    title: emergence.stage === "waking up" ? "Wallet Goes From Dormant to Active" : "Whale Emergence Detected",
    summary: `${emergence.stage} with ${emergence.emergenceScore}/100 emergence score.`,
    reason: topSignal ? `${topSignal.label}: ${topSignal.value}. ${emergence.whyItMatters}` : emergence.whyItMatters,
    sourceLabel: "GoldRush wallet activity",
    group: "Whale emergence",
  };
}

function buildTransactionAlert(address: string, transaction: WalletTransaction, walletTransactions: WalletTransaction[]): WhaleAlert {
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
        ? "GoldRush transaction classification crossed the high-risk monitoring threshold."
        : "Recent GoldRush activity matched the watchlist intelligence rules.",
    sourceLabel: "GoldRush transactions",
    group: kind === "dex_activity_spike" || kind === "dex_activity" ? "DEX activity" : "Wallet activity",
  };
}

export async function getLiveAlertFeed(): Promise<AlertFeed> {
  let addresses = watchlistAddresses().slice(0, 6);
  let autoWatchlist: AutoWatchlistEntry[] = [];
  let autoDetections: Awaited<ReturnType<typeof detectAutoWhales>>["detections"] = [];

  if (!addresses.length) {
    const detected = await detectAutoWhales({
      loadRecentActivity: getRecentGoldRushActivityCandidates,
      loadSnapshot: getGoldRushWalletSnapshot,
    });
    autoDetections = detected.detections;
    addresses = detected.detections.map((detection) => detection.address);

    if (!addresses.length) {
      const auto = await buildAutoWatchlist(getGoldRushWalletSnapshot);
      autoWatchlist = auto.wallets;
      addresses = auto.wallets.map((wallet) => wallet.address);

      if (!addresses.length) {
        return { alerts: [], source: detected.source === "goldrush" ? detected.source : auto.source, reason: detected.reason ?? auto.reason };
      }
    }
  }

  const snapshots = (await Promise.all(addresses.map((address) => getGoldRushWalletSnapshot(address)))).filter(Boolean) as Array<
    NonNullable<Awaited<ReturnType<typeof getGoldRushWalletSnapshot>>>
  >;

  if (!snapshots.length) {
    return {
      alerts: [],
      source: "fallback",
      reason: "goldrush_unavailable",
    };
  }

  const snapshotByAddress = new Map(snapshots.map((snapshot) => [snapshot.address, snapshot]));

  const newWatchlistAlerts = autoWatchlist.slice(0, 3).flatMap((wallet): WhaleAlert[] => {
    const snapshot = snapshotByAddress.get(wallet.address);
    const timestamp = snapshot?.transactions[0]?.timestamp;
    if (!timestamp) return [];
    return [{
      id: `watchlist-${wallet.address}`,
      kind: "new_watchlist_wallet",
      wallet: wallet.address,
      token: snapshot?.balances[0]?.symbol ?? snapshot?.transactions[0]?.token ?? "UNKNOWN",
      amountUsd: snapshot?.balances.reduce((sum, balance) => sum + balance.valueUsd, 0) ?? 0,
      venue: "Auto watchlist",
      timestamp,
      severity: wallet.score >= 70 ? "high" : wallet.score >= 45 ? "moderate" : "low",
      title: "New Wallet Enters Watchlist",
      summary: `Auto-ranked wallet scored ${wallet.score}/100 from GoldRush evidence.`,
      reason: wallet.reason,
      sourceLabel: "GoldRush auto watchlist",
      group: "Watchlist builder",
    }];
  });

  const detectionAlerts = autoDetections.slice(0, 4).flatMap((detection): WhaleAlert[] => {
    const snapshot = snapshotByAddress.get(detection.address);
    const timestamp = snapshot?.transactions[0]?.timestamp;
    if (!timestamp) return [];
    return [{
      id: `detection-${detection.address}`,
      kind: detection.signals.some((signal) => signal.includes("DEX")) ? "dex_activity_spike" : detection.signals.length >= 3 ? "activity_cluster_burst" : "new_watchlist_wallet",
      wallet: detection.address,
      token: snapshot?.balances[0]?.symbol ?? snapshot?.transactions[0]?.token ?? "UNKNOWN",
      amountUsd: snapshot?.balances.reduce((sum, balance) => sum + balance.valueUsd, 0) ?? 0,
      venue: "Auto discovery",
      timestamp,
      severity: detection.score >= 82 ? "critical" : detection.score >= 64 ? "high" : detection.score >= 48 ? "moderate" : "low",
      title: detection.signals.length >= 3 ? "Activity Cluster Burst" : "New Wallet of Interest",
      summary: `${detection.stage} wallet scored ${detection.score}/100 from recent GoldRush activity.`,
      reason: detection.reason,
      sourceLabel: "GoldRush auto discovery",
      group: "Auto discovery",
    }];
  });

  const alerts = sortBreakingAlerts([
    ...detectionAlerts,
    ...newWatchlistAlerts,
    ...snapshots.flatMap((snapshot) => [
      buildEmergenceAlert(snapshot),
      ...snapshot.transactions.slice(0, 5).map((transaction) => buildTransactionAlert(snapshot.address, transaction, snapshot.transactions)),
    ]),
  ].filter(Boolean) as WhaleAlert[])
    .slice(0, 12);

  return {
    alerts,
    source: "goldrush",
  };
}

export async function getLiveAlerts() {
  return (await getLiveAlertFeed()).alerts;
}
