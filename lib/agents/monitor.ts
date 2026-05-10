import { getWalletEventEvidence, getWalletReport } from "@/lib/goldrush";
import { detectDrainerApprovals, detectLiquidityPulls, detectPhishingAirdrops } from "@/lib/agents/detectors";
import type { AgentDetection } from "@/types/sentinel";

export type AgentMonitorResult = {
  status: "active" | "insufficient evidence";
  detections: AgentDetection[];
  reason?: string;
};

export async function monitorWalletAgents(wallet: string): Promise<AgentMonitorResult> {
  const [report, evidence] = await Promise.all([
    getWalletReport(wallet),
    getWalletEventEvidence(wallet),
  ]);

  if (report.source !== "goldrush" && evidence.source !== "goldrush") {
    return { status: "insufficient evidence", detections: [], reason: "goldrush_unavailable" };
  }

  const detections = [
    ...detectDrainerApprovals(report, evidence.data),
    ...detectLiquidityPulls(report, evidence.data),
    ...detectPhishingAirdrops(report, evidence.data),
  ].sort((a, b) => b.confidence - a.confidence);

  return detections.length
    ? { status: "active", detections }
    : { status: "insufficient evidence", detections: [], reason: "insufficient evidence" };
}

export async function monitorAgentWatchlist(wallets: string[]): Promise<AgentMonitorResult> {
  if (!wallets.length) {
    return { status: "insufficient evidence", detections: [], reason: "no_watchlist" };
  }

  const results = await Promise.all(wallets.slice(0, 6).map((wallet) => monitorWalletAgents(wallet)));
  const detections = results.flatMap((result) => result.detections).sort((a, b) => b.confidence - a.confidence).slice(0, 12);

  return detections.length
    ? { status: "active", detections }
    : { status: "insufficient evidence", detections: [], reason: "insufficient evidence" };
}
