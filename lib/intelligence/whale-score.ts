import type { EvidenceSignal, WhaleScore, WalletBalance, WalletReport, WalletTransaction } from "@/types/sentinel";

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDH", "UXD", "DAI", "PYUSD"]);

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function newestTransactionAgeHours(transactions: WalletTransaction[]) {
  const newest = transactions
    .map((transaction) => new Date(transaction.timestamp).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!newest) return null;
  return (Date.now() - newest) / 3_600_000;
}

function recentTransactions(transactions: WalletTransaction[], hours: number) {
  const cutoff = Date.now() - hours * 3_600_000;
  return transactions.filter((transaction) => new Date(transaction.timestamp).getTime() >= cutoff);
}

function evidenceSignal(signal: string, points: number, evidence: string): EvidenceSignal {
  return {
    signal,
    severity: points >= 28 ? "high" : points >= 16 ? "moderate" : "low",
    confidence: clamp(points * 2.6),
    evidence,
  };
}

export function scoreWhaleWallet(report: WalletReport): WhaleScore {
  const signals: EvidenceSignal[] = [];
  const balances = report.balances;
  const transactions = report.transactions;
  const totalValue = balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const swaps = transactions.filter((transaction) => transaction.type === "swap");
  const inbound = transactions.filter((transaction) => transaction.direction === "inbound");
  const stablecoinInflows = inbound.filter((transaction) => STABLE_SYMBOLS.has(transaction.token.toUpperCase()));
  const highValueTransactions = transactions.filter((transaction) => transaction.amountUsd >= 50_000);
  const recent = recentTransactions(transactions, 24);
  const recentInbound = recent.filter((transaction) => transaction.direction === "inbound");
  const repeatedDexUse = new Set(swaps.map((transaction) => transaction.counterparty)).size;
  const topBalance = balances[0];
  const newestAge = newestTransactionAgeHours(transactions);

  if (inbound.length >= 3) {
    signals.push(evidenceSignal("repeated_accumulation", 16 + Math.min(inbound.length * 3, 18), `${inbound.length} inbound transactions are present in the GoldRush wallet history.`));
  }

  if (recentInbound.length >= 2) {
    signals.push(evidenceSignal("rising_balance_trend", 18 + Math.min(recentInbound.length * 4, 20), `${recentInbound.length} inbound movements occurred in the last 24 hours.`));
  }

  if (swaps.length >= 3) {
    signals.push(evidenceSignal("high_swap_frequency", 15 + Math.min(swaps.length * 4, 24), `${swaps.length} swap transactions are visible in GoldRush transaction history.`));
  }

  if (stablecoinInflows.length > 0) {
    const stableValue = stablecoinInflows.reduce((sum, transaction) => sum + transaction.amountUsd, 0);
    signals.push(evidenceSignal("stablecoin_inflows", stableValue >= 50_000 ? 28 : 16, `${stablecoinInflows.length} stablecoin inflow${stablecoinInflows.length === 1 ? "" : "s"} total ${Math.round(stableValue).toLocaleString()} USD.`));
  }

  if (recent.length >= 5) {
    signals.push(evidenceSignal("burst_activity", 24 + Math.min(recent.length * 3, 24), `${recent.length} transactions occurred in the last 24 hours.`));
  }

  if (repeatedDexUse >= 2 || swaps.length >= 2) {
    signals.push(evidenceSignal("repeated_dex_use", 15 + Math.min(swaps.length * 3, 18), `${swaps.length} DEX-like swap transactions are visible across ${Math.max(1, repeatedDexUse)} counterparties.`));
  }

  if (topBalance && topBalance.concentration >= 35) {
    signals.push(evidenceSignal("concentrated_token_ownership", topBalance.concentration >= 55 ? 32 : 20, `${topBalance.symbol} is ${topBalance.concentration}% of visible GoldRush balance value.`));
  }

  if (highValueTransactions.length >= 2) {
    signals.push(evidenceSignal("movement_acceleration", 22 + Math.min(highValueTransactions.length * 4, 24), `${highValueTransactions.length} transactions crossed the 50,000 USD notional threshold.`));
  }

  if (signals.length < 2 && totalValue < 50_000 && transactions.length < 5) {
    return {
      wallet: report.address,
      classification: "insufficient evidence",
      score: 0,
      confidence: 0,
      reason: "insufficient evidence",
      signals,
    };
  }

  const score = clamp(
    Math.min(totalValue / 20_000, 30) +
      Math.min(transactions.length * 3, 24) +
      signals.reduce((sum, signal) => sum + signal.confidence * 0.08, 0) +
      Math.min(highValueTransactions.length * 8, 24),
  );
  const confidence = clamp(35 + signals.length * 10 + Math.min(transactions.length * 2, 25) + Math.min(balances.length * 2, 10));
  const dormant = newestAge !== null && newestAge > 24 * 30 && totalValue >= 50_000;
  const waking = newestAge !== null && newestAge <= 24 * 7 && transactions.length <= 4 && totalValue >= 50_000;
  const classification =
    score >= 78
      ? "whale-risk"
      : dormant
        ? "dormant"
        : waking
          ? "waking"
          : score >= 56
            ? "active"
            : score >= 34
              ? "emerging"
              : "insufficient evidence";

  return {
    wallet: report.address,
    classification,
    score,
    confidence,
    reason: classification === "insufficient evidence" ? "insufficient evidence" : `${classification} classification from ${signals.length} GoldRush-backed signal${signals.length === 1 ? "" : "s"}.`,
    signals,
  };
}

export function balanceTrendDirection(balances: WalletBalance[], transactions: WalletTransaction[]) {
  const inboundValue = transactions.filter((transaction) => transaction.direction === "inbound").reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const outboundValue = transactions.filter((transaction) => transaction.direction === "outbound").reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const visibleValue = balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  if (inboundValue > outboundValue * 1.4 && visibleValue > 0) return "rising";
  if (outboundValue > inboundValue * 1.4) return "falling";
  return "flat";
}
