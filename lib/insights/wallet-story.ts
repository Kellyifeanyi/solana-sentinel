import type { RiskLevel, WalletReport, WalletTransaction } from "@/types/sentinel";

export type WalletStoryInsight = {
  id: string;
  title: string;
  narrative: string;
  severity: RiskLevel;
  evidence: {
    label: string;
    value: string | number;
  }[];
};

export type WalletStory = {
  wallet: string;
  source: WalletReport["source"];
  generatedAt: string;
  summary: string;
  insights: WalletStoryInsight[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function newestFirst(transactions: WalletTransaction[]) {
  return [...transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function daysSince(timestamp: string) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round((Date.now() - value) / DAY_MS));
}

function severityForScore(score: number): RiskLevel {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "moderate";
  return "low";
}

function transactionWindow(transactions: WalletTransaction[], days: number) {
  const cutoff = Date.now() - days * DAY_MS;
  return transactions.filter((transaction) => new Date(transaction.timestamp).getTime() >= cutoff);
}

export function buildWalletStory(report: WalletReport): WalletStory {
  const transactions = newestFirst(report.transactions);
  const recentTransactions = transactionWindow(transactions, 7);
  const dexTransactions = recentTransactions.filter((transaction) => transaction.type === "swap");
  const whaleTransactions = transactions.filter((transaction) => transaction.amountUsd >= 250_000);
  const highRiskTransactions = transactions.filter((transaction) => transaction.risk === "high" || transaction.risk === "critical");
  const firstSeenDays = transactions.at(-1) ? daysSince(transactions.at(-1)!.timestamp) : null;
  const totalRecentVolume = recentTransactions.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const largestBalance = report.balances[0];

  const insights: WalletStoryInsight[] = [];

  if (firstSeenDays !== null) {
    insights.push({
      id: "accumulation-window",
      title: "Tracked Activity Window",
      narrative:
        firstSeenDays === 0
          ? `GoldRush returned ${transactions.length} tracked transactions, with the earliest observed inside the last 24 hours.`
          : `GoldRush returned ${transactions.length} tracked transactions, with the earliest observed ${firstSeenDays} days ago.`,
      severity: firstSeenDays <= 3 && totalRecentVolume > 100_000 ? "high" : "moderate",
      evidence: [
        { label: "Observed transactions", value: transactions.length },
        { label: "Recent volume USD", value: Math.round(totalRecentVolume) },
      ],
    });
  }

  if (whaleTransactions.length > 0) {
    const largestTransfer = whaleTransactions.reduce((largest, transaction) =>
      transaction.amountUsd > largest.amountUsd ? transaction : largest,
    );

    insights.push({
      id: "whale-transfer-pattern",
      title: "Whale Transfer Pattern",
      narrative: `${whaleTransactions.length} tracked transactions are at or above $250k notional, led by ${largestTransfer.token}.`,
      severity: largestTransfer.amountUsd >= 1_000_000 ? "critical" : "high",
      evidence: [
        { label: "Whale-sized transfers", value: whaleTransactions.length },
        { label: "Largest transfer USD", value: Math.round(largestTransfer.amountUsd) },
        { label: "Token", value: largestTransfer.token },
      ],
    });
  }

  if (dexTransactions.length > 0) {
    insights.push({
      id: "dex-velocity",
      title: "DEX Velocity",
      narrative: `Wallet executed ${dexTransactions.length} DEX swap${dexTransactions.length === 1 ? "" : "s"} across ${recentTransactions.length} transactions in the 7-day tracked window.`,
      severity: dexTransactions.length >= 3 ? "high" : "moderate",
      evidence: [
        { label: "Recent swaps", value: dexTransactions.length },
        { label: "Recent transactions", value: recentTransactions.length },
      ],
    });
  }

  if (largestBalance) {
    insights.push({
      id: "portfolio-concentration",
      title: "Portfolio Concentration",
      narrative:
        largestBalance.concentration >= 40
          ? `${largestBalance.symbol} accounts for ${largestBalance.concentration}% of visible GoldRush balance value.`
          : `${largestBalance.symbol} is the largest visible position at ${largestBalance.concentration}% of tracked balance value.`,
      severity: largestBalance.concentration >= 45 ? "high" : severityForScore(report.signals.concentrationScore),
      evidence: [
        { label: "Largest asset", value: largestBalance.symbol },
        { label: "Concentration", value: `${largestBalance.concentration}%` },
      ],
    });
  }

  if (highRiskTransactions.length > 0 || report.signals.suspiciousTokens.length > 0) {
    insights.push({
      id: "risk-surface",
      title: "Risk Surface",
      narrative: `${highRiskTransactions.length} elevated transaction${highRiskTransactions.length === 1 ? "" : "s"} and ${report.signals.suspiciousTokens.length} token warning${report.signals.suspiciousTokens.length === 1 ? "" : "s"} are backed by GoldRush evidence.`,
      severity: report.level,
      evidence: [
        { label: "High-risk transactions", value: highRiskTransactions.length },
        { label: "Suspicious tokens", value: report.signals.suspiciousTokens.length },
      ],
    });
  }

  return {
    wallet: report.address,
    source: report.source,
    generatedAt: new Date().toISOString(),
    summary:
      insights.length > 0
        ? "Structured observations below are derived from normalized GoldRush balances and transactions."
        : "Insufficient chain evidence in the current GoldRush response to generate wallet behavior insights.",
    insights: insights.slice(0, 5),
  };
}
