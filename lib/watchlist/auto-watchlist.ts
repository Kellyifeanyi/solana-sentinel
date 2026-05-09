import type { AutoWatchlistResult, WalletBalance, WalletTransaction } from "@/types/sentinel";
import { isLikelyRealWallet, parseAddressList, uniqueWalletCandidates } from "@/lib/watchlist/filters";
import { scoreWatchlistWallet } from "@/lib/watchlist/scorer";

type WalletSnapshot = {
  address: string;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
};

type WalletLoader = (address: string) => Promise<WalletSnapshot | null>;

export function configuredWatchlistAddresses() {
  return parseAddressList(process.env.SENTINEL_WATCHLIST);
}

export function autoWatchlistSeedAddresses() {
  return uniqueWalletCandidates([
    ...parseAddressList(process.env.SENTINEL_AUTO_WATCHLIST_SEEDS),
    ...parseAddressList(process.env.SENTINEL_SEED_WALLETS),
  ]);
}

function candidateAddressesFromSnapshots(snapshots: WalletSnapshot[]) {
  return uniqueWalletCandidates(
    snapshots.flatMap((snapshot) => [
      snapshot.address,
      ...snapshot.transactions.map((transaction) => transaction.counterparty),
    ]),
  );
}

export async function buildAutoWatchlist(loadWallet: WalletLoader): Promise<AutoWatchlistResult> {
  const seeds = autoWatchlistSeedAddresses();
  if (!seeds.length) {
    return {
      wallets: [],
      source: "empty",
      reason: "missing_SENTINEL_WATCHLIST_and_SENTINEL_AUTO_WATCHLIST_SEEDS",
    };
  }

  const seedSnapshots = (await Promise.all(seeds.slice(0, 6).map((address) => loadWallet(address)))).filter(Boolean) as WalletSnapshot[];
  const candidates = candidateAddressesFromSnapshots(seedSnapshots).slice(0, 18);

  if (!candidates.length) {
    return {
      wallets: [],
      source: "empty",
      reason: "goldrush_seed_activity_unavailable",
    };
  }

  const candidateSnapshots = (await Promise.all(candidates.map((address) => loadWallet(address)))).filter(Boolean) as WalletSnapshot[];
  const wallets = candidateSnapshots
    .filter((snapshot) => isLikelyRealWallet(snapshot))
    .map((snapshot) => scoreWatchlistWallet(snapshot))
    .filter((entry) => entry.score >= 18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!wallets.length) {
    return {
      wallets: [],
      source: "empty",
      reason: "no_real_wallet_candidates_found",
    };
  }

  return {
    wallets,
    source: "goldrush",
  };
}
