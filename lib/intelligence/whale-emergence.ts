import type { WalletBalance, WalletTransaction, WhaleEmergence, WhaleEmergenceSignal, WhaleEmergenceStage } from "@/types/sentinel";

const DAY_MS = 24 * 60 * 60 * 1000;

function scoreToStage(score: number): WhaleEmergenceStage {
  if (score >= 86) return "whale-like";
  if (score >= 70) return "active whale candidate";
  if (score >= 52) return "emerging";
  if (score >= 34) return "waking up";
  return "dormant";
}

function addSignal(signals: WhaleEmergenceSignal[], label: string, value: string, weight: number) {
  if (weight > 0) signals.push({ label, value, weight });
}

function recentWindow(transactions: WalletTransaction[], days: number) {
  const now = Date.now();
  return transactions.filter((transaction) => now - new Date(transaction.timestamp).getTime() <= days * DAY_MS);
}

export function detectWhaleEmergence({
  address,
  balances,
  transactions,
}: {
  address: string;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
}): WhaleEmergence {
  const signals: WhaleEmergenceSignal[] = [];
  const recent = recentWindow(transactions, 2);
  const prior = transactions.filter((transaction) => !recent.includes(transaction));
  const recentVolume = recent.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const priorVolume = prior.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const totalValue = balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const dexCount = recent.filter((transaction) => transaction.type === "swap").length;
  const highVelocityCount = recent.filter((transaction) => transaction.amountUsd >= 50_000).length;
  const retentionValue = balances.filter((balance) => balance.valueUsd >= 10_000).reduce((sum, balance) => sum + balance.valueUsd, 0);
  const highActivityTokens = new Set(
    recent
      .filter((transaction) => transaction.type === "swap" || transaction.amountUsd >= 25_000)
      .map((transaction) => transaction.token),
  );

  addSignal(
    signals,
    "Accumulation acceleration",
    recentVolume > priorVolume ? `${Math.round(Math.max(recentVolume / Math.max(priorVolume, 1), 1))}x recent volume` : "stable",
    recentVolume > 25_000 && recentVolume > priorVolume * 1.5 ? 22 : 0,
  );
  addSignal(signals, "First meaningful DEX activity", `${dexCount} recent swaps`, dexCount > 0 && prior.every((tx) => tx.type !== "swap") ? 18 : dexCount * 7);
  addSignal(signals, "Inflow retention", `$${Math.round(retentionValue).toLocaleString()} retained`, retentionValue >= 25_000 ? 18 : 0);
  addSignal(signals, "Transfer velocity growth", `${highVelocityCount} high-value moves`, highVelocityCount * 10);
  addSignal(signals, "High-activity token exposure", `${highActivityTokens.size} tokens`, highActivityTokens.size * 7);
  addSignal(signals, "Holder influence", `$${Math.round(totalValue).toLocaleString()} current value`, totalValue >= 250_000 ? 16 : totalValue >= 50_000 ? 8 : 0);

  const emergenceScore = Math.max(0, Math.min(100, Math.round(signals.reduce((sum, signal) => sum + signal.weight, 0))));
  const stage = scoreToStage(emergenceScore);
  const strongest = [...signals].sort((a, b) => b.weight - a.weight)[0];

  return {
    address,
    emergenceScore,
    stage,
    signals,
    whyItMatters: strongest
      ? `${strongest.label} is moving faster than the wallet's prior GoldRush activity profile.`
      : "GoldRush data does not show enough emergence behavior yet.",
  };
}
