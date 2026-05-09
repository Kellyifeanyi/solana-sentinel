import type { SignalAction } from "@/types/signal-action";
import type { WalletReport } from "@/types/sentinel";

const TOKENS = {
  SOL: {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  JUP: {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
  },
} as const;

function actionPair(input: keyof typeof TOKENS, output: keyof typeof TOKENS, amount: number) {
  return {
    inputSymbol: TOKENS[input].symbol,
    inputMint: TOKENS[input].mint,
    inputDecimals: TOKENS[input].decimals,
    outputSymbol: TOKENS[output].symbol,
    outputMint: TOKENS[output].mint,
    outputDecimals: TOKENS[output].decimals,
    amount,
  };
}

export function deriveActionOpportunities(report: WalletReport): SignalAction[] {
  if (report.source !== "goldrush") return [];

  const opportunities: SignalAction[] = [];
  const transactions = report.transactions;
  const swaps = transactions.filter((transaction) => transaction.type === "swap");
  const stablecoinBalance = report.balances.find((balance) => ["USDC", "USDT"].includes(balance.symbol.toUpperCase()));
  const solBalance = report.balances.find((balance) => balance.symbol.toUpperCase() === "SOL");
  const jupBalance = report.balances.find((balance) => balance.symbol.toUpperCase() === "JUP");
  const largeTransfers = transactions.filter((transaction) => transaction.type === "transfer" && transaction.amountUsd >= 100_000);

  if (stablecoinBalance && stablecoinBalance.valueUsd >= 10_000 && swaps.length >= 2) {
    opportunities.push({
      id: "stablecoin-rotation-preview",
      title: "Stablecoin Rotation Preview",
      reason: `Wallet holds ${stablecoinBalance.symbol} exposure and executed ${swaps.length} tracked DEX swaps.`,
      confidence: swaps.length >= 5 ? "high" : "moderate",
      suggestedAction: "Preview a small USDC to SOL route before taking directional exposure.",
      tokenPair: actionPair("USDC", "SOL", 25),
      supportingSignals: [
        `${stablecoinBalance.symbol} visible balance value is $${Math.round(stablecoinBalance.valueUsd).toLocaleString()}.`,
        `${swaps.length} GoldRush transactions are classified as swaps.`,
      ],
    });
  }

  if (largeTransfers.length >= 2 && solBalance && solBalance.valueUsd >= 1_000) {
    opportunities.push({
      id: "sol-exposure-rebalance",
      title: "SOL Exposure Route Check",
      reason: `${largeTransfers.length} large transfers appeared in the tracked transaction window while SOL is present in balances.`,
      confidence: largeTransfers.length >= 4 ? "high" : "moderate",
      suggestedAction: "Preview a SOL to USDC route to quantify exit liquidity before mirroring exposure.",
      tokenPair: actionPair("SOL", "USDC", 0.05),
      supportingSignals: [
        `${largeTransfers.length} transfers are at or above $100k notional.`,
        `Visible SOL balance value is $${Math.round(solBalance.valueUsd).toLocaleString()}.`,
      ],
    });
  }

  if (jupBalance && jupBalance.concentration >= 15 && swaps.length > 0) {
    opportunities.push({
      id: "jup-dex-liquidity-check",
      title: "JUP Liquidity Route Check",
      reason: `JUP is ${jupBalance.concentration}% of visible balances and the wallet has tracked DEX activity.`,
      confidence: jupBalance.concentration >= 30 && swaps.length >= 3 ? "high" : "moderate",
      suggestedAction: "Preview a JUP to USDC route to measure current executable liquidity.",
      tokenPair: actionPair("JUP", "USDC", 5),
      supportingSignals: [
        `JUP concentration is ${jupBalance.concentration}% of visible balance value.`,
        `${swaps.length} GoldRush transactions are classified as swaps.`,
      ],
    });
  }

  return opportunities.slice(0, 3);
}
