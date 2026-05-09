import { getWalletReport } from "@/lib/goldrush";
import { buildWalletStory } from "@/lib/insights/wallet-story";
import { compactAddress, formatUsd } from "@/lib/utils";

export async function GET(request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  const url = new URL(request.url);
  const paid = url.searchParams.get("paid") === "true";
  const decoded = decodeURIComponent(wallet);

  if (!paid) {
    return Response.json(
      {
        error: "payment_required",
        message: "402 Payment Required. Unlock structured wallet intelligence.",
        accepts: [{ scheme: "x402", asset: "USDC", amount: "0.05", network: "solana-mainnet" }],
      },
      { status: 402, headers: { "X-402-Accepts": "USDC:0.05:solana-mainnet" } },
    );
  }

  const report = await getWalletReport(decoded);
  const story = buildWalletStory(report);
  const totalValue = report.balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const swapCount = report.transactions.filter((transaction) => transaction.type === "swap").length;
  const transferCount = report.transactions.filter((transaction) => transaction.type === "transfer").length;
  const topInsight = story.insights[0];

  const insight =
    report.source !== "goldrush"
      ? `${compactAddress(decoded, 7)} has insufficient GoldRush chain evidence for premium intelligence. No behavioral conclusion is generated.`
      : [
          `${compactAddress(decoded, 7)} premium evidence summary: ${report.transactions.length} tracked transactions, ${swapCount} swaps, ${transferCount} transfers, and ${formatUsd(totalValue)} visible balance value.`,
          topInsight ? `Primary observation: ${topInsight.narrative}` : "Primary observation: insufficient evidence for a behavioral pattern.",
          report.signals.suspiciousTokens.length
            ? `Token warnings: ${report.signals.suspiciousTokens.map((token) => `${token.symbol} (${token.confidence})`).join(", ")}.`
            : "Token warnings: no suspicious-token evidence met the configured thresholds.",
        ].join(" ");

  return Response.json({
    wallet: decoded,
    insight,
  });
}
