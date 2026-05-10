import { isLikelyRealWallet, isLikelySolanaWalletAddress, uniqueWalletCandidates } from "@/lib/watchlist/filters";
import type { WalletReport } from "@/types/sentinel";

export function filterWatchlistCandidates(candidates: string[]) {
  return uniqueWalletCandidates(candidates).filter(isLikelySolanaWalletAddress);
}

export function filterGoldRushWalletReports(reports: WalletReport[]) {
  return reports.filter((report) =>
    report.source === "goldrush" &&
    isLikelyRealWallet({
      address: report.address,
      balances: report.balances,
      transactions: report.transactions,
    }),
  );
}
