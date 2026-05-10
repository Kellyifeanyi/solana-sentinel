import { scoreWhaleWallet } from "@/lib/intelligence/whale-score";
import type { WatchlistWallet, WalletReport } from "@/types/sentinel";

export function scoreWatchlistWallet(report: WalletReport): WatchlistWallet {
  const whale = scoreWhaleWallet(report);
  const score = whale.reason === "insufficient evidence" ? Math.min(report.score, 20) : Math.max(report.score, whale.score);

  return {
    address: report.address,
    score,
    confidence: whale.confidence,
    reason: whale.reason,
    source: "goldrush",
    signals: whale.signals,
  };
}

export function rankWatchlist(wallets: WatchlistWallet[]) {
  return [...wallets]
    .filter((wallet) => wallet.reason !== "insufficient evidence" && wallet.confidence > 0)
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta) return scoreDelta;
      return b.confidence - a.confidence;
    });
}
