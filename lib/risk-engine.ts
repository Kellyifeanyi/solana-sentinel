import type { RiskLevel, RiskSignals, WalletBalance, WalletTransaction } from "@/types/sentinel";

export function riskLevel(score: number): RiskLevel {
  if (score >= 82) return "critical";
  if (score >= 64) return "high";
  if (score >= 38) return "moderate";
  return "low";
}

export function calculateRiskScore(
  balances: WalletBalance[],
  transactions: WalletTransaction[],
  signals: RiskSignals,
) {
  const suspiciousLoad = Math.min(100, signals.suspiciousTokens.reduce((sum, token) => {
    const severity = token.severity === "critical" ? 34 : token.severity === "high" ? 22 : 10;
    return sum + severity;
  }, 0));
  const highRiskTransferLoad = Math.min(100, transactions.filter((tx) => tx.risk === "high" || tx.risk === "critical").length * 18);
  const maxBalanceConcentration = balances.length > 0 ? Math.max(...balances.map((balance) => balance.concentration)) : 0;
  const concentration = Math.max(signals.concentrationScore, maxBalanceConcentration);

  return Math.round(
    suspiciousLoad * 0.28 +
      concentration * 0.2 +
      signals.transferBehaviorScore * 0.18 +
      signals.volatilityExposureScore * 0.18 +
      Math.max(signals.transactionFrequencyScore, highRiskTransferLoad) * 0.16,
  );
}

export function buildRecommendations(score: number, signals: RiskSignals) {
  const recommendations: string[] = [];

  if (signals.suspiciousTokens.length > 0) {
    recommendations.push(
      `Review ${signals.suspiciousTokens.length} token exposure warning${signals.suspiciousTokens.length === 1 ? "" : "s"} with listed GoldRush evidence before acting.`,
    );
  }

  if (signals.concentrationScore >= 60) {
    recommendations.push("Portfolio concentration is measurable from balances; verify liquidity depth before increasing the largest visible position.");
  }

  if (signals.transferBehaviorScore >= 50) {
    recommendations.push("Tracked transactions include elevated notional movement; keep alert thresholds focused on repeated counterparties and DEX interactions.");
  }

  if (signals.volatilityExposureScore > 65) {
    recommendations.push("Visible balances include high 24h price movement; size any action against current liquidity and route preview.");
  }

  if (score < 38 && recommendations.length === 0) {
    recommendations.push("Insufficient elevated evidence in the current GoldRush window; continue monitoring wallet activity.");
  }

  return recommendations;
}
