import { getWalletReport, goldrushFetch } from "@/lib/goldrush";
import { filterGoldRushWalletReports, filterWatchlistCandidates } from "@/lib/watchlist/filter";
import { parseAddressList } from "@/lib/watchlist/filters";
import { rankWatchlist, scoreWatchlistWallet } from "@/lib/watchlist/score";
import type { WatchlistWallet } from "@/types/sentinel";

const CHAIN = "solana-mainnet";
const MAX_SEEDS = 8;
const MAX_CANDIDATES = 90;

type TokenHolderItem = {
  address?: string | null;
  holder_address?: string | null;
  owner_address?: string | null;
  wallet_address?: string | null;
};

type TransactionItem = {
  from_address?: string | null;
  to_address?: string | null;
  log_events?: Array<{
    sender_address?: string | null;
    decoded?: {
      params?: Array<{ name?: string | null; value?: string | null }> | null;
    } | null;
  }> | null;
};

type BalanceItem = {
  contract_address?: string | null;
  contract_ticker_symbol?: string | null;
  balance?: string | null;
  log_events?: Array<{ sender_address?: string | null }> | null;
};

function configuredInputs() {
  const autoSeeds = parseAddressList(process.env.SENTINEL_AUTO_WATCHLIST_SEEDS);
  const watchlist = parseAddressList(process.env.SENTINEL_WATCHLIST);
  return {
    discoverySeeds: [...autoSeeds, ...watchlist].slice(0, MAX_SEEDS),
    explicitWallets: filterWatchlistCandidates(watchlist).slice(0, MAX_SEEDS),
  };
}

function discoveryMode() {
  return process.env.SENTINEL_DISCOVERY_MODE?.trim().toLowerCase() ?? "auto";
}

function allowEmptyWatchlist() {
  return process.env.SENTINEL_ALLOW_EMPTY?.trim().toLowerCase() !== "false";
}

function sentinelDebugEnabled() {
  return process.env.SENTINEL_DEBUG?.trim().toLowerCase() === "true";
}

function holderAddress(item: TokenHolderItem) {
  return item.address ?? item.holder_address ?? item.owner_address ?? item.wallet_address ?? null;
}

function decodedWalletCandidates(item: TransactionItem) {
  return (item.log_events ?? []).flatMap((event) => [
    event.sender_address,
    ...(event.decoded?.params ?? []).map((param) => param.value),
  ]);
}

async function balanceEvidenceCandidates(seed: string) {
  const result = await goldrushFetch<{ items?: BalanceItem[] }>(
    `${CHAIN}/address/${encodeURIComponent(seed)}/balances_v2/`,
  );

  if (result.state !== "fresh") return [];
  const hasEvidence = (result.data?.items ?? []).some((item) => Number(item.balance ?? 0) > 0 || item.contract_ticker_symbol);
  return hasEvidence ? [seed] : [];
}

async function tokenHolderCandidates(seed: string) {
  const result = await goldrushFetch<{ items?: TokenHolderItem[] }>(
    `${CHAIN}/tokens/${encodeURIComponent(seed)}/token_holders_v2/`,
  );

  return result.state === "fresh"
    ? filterWatchlistCandidates((result.data?.items ?? []).map(holderAddress).filter(Boolean) as string[])
    : [];
}

async function tokenTraderCandidates(seed: string) {
  const recent = await goldrushFetch<{ items?: TransactionItem[] }>(
    `${CHAIN}/address/${encodeURIComponent(seed)}/transactions_v3/`,
  );
  const result = recent.state === "fresh"
    ? recent
    : await goldrushFetch<{ items?: TransactionItem[] }>(
      `${CHAIN}/address/${encodeURIComponent(seed)}/transactions_v3/page/0/`,
    );

  if (result.state !== "fresh") return [];

  return filterWatchlistCandidates(
    (result.data?.items ?? []).flatMap((item) => [
      item.from_address,
      item.to_address,
      ...decodedWalletCandidates(item),
    ]).filter(Boolean) as string[],
  );
}

async function expandCandidateCounterparties(wallets: string[]) {
  const batches = await Promise.all(wallets.slice(0, 20).map((wallet) => tokenTraderCandidates(wallet)));
  return filterWatchlistCandidates(batches.flat()).slice(0, MAX_CANDIDATES);
}

export async function generateWatchlist(): Promise<{
  wallets: WatchlistWallet[];
  source: "goldrush" | "empty";
  reason?: string;
}> {
  const { discoverySeeds, explicitWallets } = configuredInputs();
  const seeds = filterWatchlistCandidates(discoverySeeds);
  if (!seeds.length) {
    return { wallets: [], source: "empty", reason: "insufficient_data" };
  }

  const [holderCandidates, traderCandidates] = await Promise.all([
    Promise.all(seeds.map((seed) => tokenHolderCandidates(seed))),
    Promise.all(seeds.map((seed) => tokenTraderCandidates(seed))),
  ]);
  const firstPass = filterWatchlistCandidates([...holderCandidates.flat(), ...traderCandidates.flat(), ...explicitWallets]).slice(0, MAX_CANDIDATES);
  const balanceEvidence = firstPass.length ? [] : (await Promise.all(seeds.map((seed) => balanceEvidenceCandidates(seed)))).flat();
  const expanded = discoveryMode() === "auto" ? await expandCandidateCounterparties(firstPass) : [];
  const candidates = filterWatchlistCandidates([...firstPass, ...expanded, ...balanceEvidence]).slice(0, MAX_CANDIDATES);

  if (!candidates.length) {
    return { wallets: [], source: "empty", reason: "insufficient_data" };
  }

  const reports = await Promise.all(candidates.map((candidate) => getWalletReport(candidate)));
  const goldrushReports = reports.filter((report) => report.source === "goldrush");
  const scored = rankWatchlist(filterGoldRushWalletReports(reports).map(scoreWatchlistWallet)).slice(0, 30);
  const fallbackScored = goldrushReports
    .map(scoreWatchlistWallet)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, 30);

  if (scored.length) return { wallets: scored, source: "goldrush" };
  if (!allowEmptyWatchlist() && fallbackScored.length) return { wallets: fallbackScored, source: "goldrush", reason: "insufficient evidence" };

  return {
    wallets: [],
    source: "empty",
    reason: sentinelDebugEnabled() && !goldrushReports.length ? "insufficient_data" : "insufficient_data",
  };
}
