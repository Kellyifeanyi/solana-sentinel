import type { AutoWatchlistEntry, WalletBalance, WalletTransaction } from "@/types/sentinel";

const DAY_MS = 24 * 60 * 60 * 1000;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recentActivityScore(transactions: WalletTransaction[]) {
  const now = Date.now();
  return transactions.reduce((score, transaction) => {
    const age = now - new Date(transaction.timestamp).getTime();
    if (!Number.isFinite(age)) return score;
    if (age <= DAY_MS) return score + 16;
    if (age <= 7 * DAY_MS) return score + 8;
    return score + 2;
  }, 0);
}

function behavioralChangeScore(transactions: WalletTransaction[]) {
  const now = Date.now();
  const recent = transactions.filter((transaction) => now - new Date(transaction.timestamp).getTime() <= DAY_MS * 2);
  const prior = transactions.filter((transaction) => {
    const age = now - new Date(transaction.timestamp).getTime();
    return age > DAY_MS * 2 && age <= DAY_MS * 10;
  });

  const recentVolume = recent.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const priorVolume = prior.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  if (!recent.length) return 0;
  if (!prior.length && recentVolume > 10_000) return 18;
  return recentVolume > priorVolume * 1.8 ? 18 : 0;
}

export function scoreWatchlistWallet({
  address,
  balances,
  transactions,
}: {
  address: string;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
}): AutoWatchlistEntry {
  const totalValue = balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const txVolume = transactions.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const dexCount = transactions.filter((transaction) => transaction.type === "swap").length;
  const highValueCount = transactions.filter((transaction) => transaction.amountUsd >= 50_000).length;
  const accumulationCount = transactions.filter((transaction) => transaction.type === "transfer" && transaction.amountUsd >= 10_000).length;
  const uniqueTokens = new Set([...balances.map((balance) => balance.symbol), ...transactions.map((tx) => tx.token)]).size;
  const uniqueCounterparties = new Set(transactions.map((transaction) => transaction.counterparty).filter(Boolean)).size;

  const score = clampScore(
    recentActivityScore(transactions) +
      dexCount * 10 +
      highValueCount * 12 +
      accumulationCount * 6 +
      behavioralChangeScore(transactions) +
      Math.min(18, Math.log10(Math.max(totalValue, 1)) * 3) +
      Math.min(12, Math.log10(Math.max(txVolume, 1)) * 2) +
      Math.min(10, uniqueCounterparties * 1.5),
  );

  const labels = [
    dexCount >= 2 ? "repeated DEX interaction" : null,
    highValueCount > 0 ? "high-value transfers" : null,
    accumulationCount >= 2 ? "repeated accumulation" : null,
    uniqueTokens >= 3 ? "multi-asset wallet" : null,
    behavioralChangeScore(transactions) > 0 ? "fast behavior change" : null,
    transactions.length >= 5 ? "consistent activity" : null,
  ].filter(Boolean) as string[];

  const reason = labels.length
    ? labels.slice(0, 3).join(", ")
    : totalValue > 0
      ? "Real wallet with positive GoldRush balance and recent activity."
      : "Real wallet with enough recent GoldRush transaction activity to monitor.";

  return {
    address,
    score,
    reason,
    labels,
  };
}
