import type { ActivityScanResult, AutoWhaleDetection, WalletBalance, WalletTransaction } from "@/types/sentinel";
import { isLikelyRealWallet, uniqueWalletCandidates } from "@/lib/watchlist/filters";

export type RecentActivityCandidate = {
  address: string;
  transactions: WalletTransaction[];
};

export type DiscoverySnapshot = {
  address: string;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
};

type SnapshotLoader = (address: string) => Promise<DiscoverySnapshot | null>;

const DAY_MS = 24 * 60 * 60 * 1000;

function stageForScore(score: number): AutoWhaleDetection["stage"] {
  if (score >= 82) return "whale-like";
  if (score >= 64) return "active";
  if (score >= 48) return "emerging";
  if (score >= 30) return "waking up";
  return "dormant";
}

function candidateAddresses(candidates: RecentActivityCandidate[]) {
  return uniqueWalletCandidates(candidates.map((candidate) => candidate.address));
}

function recentTransactions(transactions: WalletTransaction[], days: number) {
  const now = Date.now();
  return transactions.filter((transaction) => now - new Date(transaction.timestamp).getTime() <= days * DAY_MS);
}

function detectSignals(snapshot: DiscoverySnapshot) {
  const recent = recentTransactions(snapshot.transactions, 2);
  const prior = snapshot.transactions.filter((transaction) => !recent.includes(transaction));
  const recentVolume = recent.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const priorVolume = prior.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const totalValue = snapshot.balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const transferBurst = recent.filter((transaction) => transaction.type === "transfer" && transaction.amountUsd >= 25_000).length;
  const dexBurst = recent.filter((transaction) => transaction.type === "swap").length;
  const accumulation = recent.filter((transaction) => transaction.type === "transfer" && transaction.amountUsd >= 10_000).length;
  const suspicious = recent.filter((transaction) => transaction.risk === "high" || transaction.risk === "critical").length;
  const uniqueTokens = new Set(recent.map((transaction) => transaction.token).filter(Boolean)).size;

  return {
    recentVolume,
    priorVolume,
    totalValue,
    transferBurst,
    dexBurst,
    accumulation,
    suspicious,
    uniqueTokens,
  };
}

export async function scanActivityForDetections({
  candidates,
  loadSnapshot,
}: {
  candidates: RecentActivityCandidate[];
  loadSnapshot: SnapshotLoader;
}): Promise<ActivityScanResult> {
  const addresses = candidateAddresses(candidates).slice(0, 20);

  if (!addresses.length) {
    return { detections: [], source: "empty", reason: "no_recent_goldrush_activity_candidates" };
  }

  const snapshots = (await Promise.all(addresses.map((address) => loadSnapshot(address)))).filter(Boolean) as DiscoverySnapshot[];
  const detections = snapshots
    .filter((snapshot) => isLikelyRealWallet(snapshot))
    .map((snapshot): AutoWhaleDetection | null => {
      const signals = detectSignals(snapshot);
      const signalLabels = [
        signals.recentVolume >= 50_000 ? `recent volume $${Math.round(signals.recentVolume).toLocaleString()}` : null,
        signals.transferBurst >= 2 ? `${signals.transferBurst} high-value transfers` : null,
        signals.dexBurst >= 2 ? `${signals.dexBurst} DEX interactions` : null,
        signals.accumulation >= 2 ? "repeated accumulation" : null,
        signals.suspicious > 0 ? `${signals.suspicious} elevated-risk movements` : null,
        signals.recentVolume > signals.priorVolume * 1.8 && signals.recentVolume > 10_000 ? "activity acceleration" : null,
        signals.totalValue >= 100_000 ? `retained value $${Math.round(signals.totalValue).toLocaleString()}` : null,
        signals.uniqueTokens >= 3 ? `${signals.uniqueTokens} active tokens` : null,
      ].filter(Boolean) as string[];

      const score = Math.min(
        100,
        Math.round(
          Math.min(24, Math.log10(Math.max(signals.recentVolume, 1)) * 4) +
            signals.transferBurst * 12 +
            signals.dexBurst * 10 +
            signals.accumulation * 7 +
            signals.suspicious * 12 +
            (signals.recentVolume > signals.priorVolume * 1.8 && signals.recentVolume > 10_000 ? 16 : 0) +
            Math.min(18, Math.log10(Math.max(signals.totalValue, 1)) * 3),
        ),
      );

      if (score < 30 || !signalLabels.length) return null;

      return {
        address: snapshot.address,
        score,
        stage: stageForScore(score),
        reason: signalLabels.slice(0, 3).join(", "),
        signals: signalLabels,
      };
    })
    .filter((detection): detection is AutoWhaleDetection => Boolean(detection))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!detections.length) {
    return { detections: [], source: "empty", reason: "no_active_whale_like_wallets_detected" };
  }

  return { detections, source: "goldrush" };
}
