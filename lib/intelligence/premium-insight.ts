import { getWalletReport } from "@/lib/goldrush";
import { scoreWhaleWallet } from "@/lib/intelligence/whale-score";
import { x402Enabled } from "@/lib/x402/client";

export async function buildPremiumInsight(wallet: string) {
  const report = await getWalletReport(wallet);
  const whale = scoreWhaleWallet(report);

  if (report.source !== "goldrush" || whale.reason === "insufficient evidence") {
    return {
      wallet,
      gated: x402Enabled(),
      insight: "Insufficient GoldRush evidence",
      signals: whale.signals,
    };
  }

  return {
    wallet,
    gated: x402Enabled(),
    insight: `${whale.classification} wallet profile: score ${whale.score}/100 with ${whale.confidence}/100 confidence. ${whale.reason}`,
    signals: whale.signals,
  };
}
