import type { SignalAction } from "@/types/signal-action";
import type { WalletReport } from "@/types/sentinel";
import { actionPair, detectedTokenPair } from "@/lib/trading/tokens";

export function deriveActionOpportunities(report: WalletReport): SignalAction[] {
  if (report.source !== "goldrush") return [];

  const opportunities: SignalAction[] = [];
  const transactions = report.transactions;
  const swaps = transactions.filter((transaction) => transaction.type === "swap");
  const stablecoinBalance = report.balances.find((balance) => ["USDC", "USDT"].includes(balance.symbol.toUpperCase()));
  const solBalance = report.balances.find((balance) => balance.symbol.toUpperCase() === "SOL");
  const largeTransfers = transactions.filter((transaction) => transaction.type === "transfer" && transaction.amountUsd >= 100_000);
  const detectedTargets = report.balances
    .filter((balance) => balance.mintAddress && !["SOL", "USDC", "USDT"].includes(balance.symbol.toUpperCase()))
    .slice(0, 2);

  if (stablecoinBalance && stablecoinBalance.valueUsd >= 10_000 && swaps.length >= 2) {
    opportunities.push({
      id: "stablecoin-rotation-preview",
      title: "Stablecoin Rotation Preview",
      reason: `Wallet holds ${stablecoinBalance.symbol} exposure and executed ${swaps.length} tracked DEX swaps.`,
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
      suggestedAction: "Preview a SOL to USDC route to quantify exit liquidity before mirroring exposure.",
      tokenPair: actionPair("SOL", "USDC", 0.05),
      supportingSignals: [
        `${largeTransfers.length} transfers are at or above $100k notional.`,
        `Visible SOL balance value is $${Math.round(solBalance.valueUsd).toLocaleString()}.`,
      ],
    });
  }

  for (const balance of detectedTargets) {
    opportunities.push({
      id: `detected-token-${balance.symbol.toLowerCase()}-${balance.mintAddress}`,
      title: `Detected ${balance.symbol} Route Check`,
      reason: `${balance.symbol} is present in GoldRush balances with ${Math.round(balance.valueUsd).toLocaleString()} USD tracked value.`,
      suggestedAction: `Preview a USDC to ${balance.symbol} route against the detected token mint.`,
      tokenPair: detectedTokenPair({
        input: "USDC",
        output: balance.symbol,
        outputMint: balance.mintAddress!,
        outputDecimals: balance.decimals,
        amount: 25,
      }),
      supportingSignals: [
        `${balance.symbol} was returned by GoldRush balances for this wallet.`,
        `Detected mint ${balance.mintAddress}.`,
      ],
    });
  }

  return opportunities.slice(0, 3);
}
