import { balanceTrendDirection, scoreWhaleWallet } from "@/lib/intelligence/whale-score";
import type { EvidenceSignal, WalletReport } from "@/types/sentinel";

export type EmergenceSignal = {
  wallet: string;
  status: "emerging" | "watch" | "insufficient evidence";
  confidence: number;
  reason: string;
  signals: EvidenceSignal[];
};

export function predictWhaleEmergence(report: WalletReport): EmergenceSignal {
  const whale = scoreWhaleWallet(report);
  const trend = balanceTrendDirection(report.balances, report.transactions);
  const emergenceSignals = whale.signals.filter((signal) =>
    ["repeated_accumulation", "rising_balance_trend", "stablecoin_inflows", "burst_activity", "movement_acceleration"].includes(signal.signal),
  );

  if (whale.reason === "insufficient evidence" || emergenceSignals.length < 2 || trend !== "rising") {
    return {
      wallet: report.address,
      status: "insufficient evidence",
      confidence: 0,
      reason: "insufficient evidence",
      signals: emergenceSignals,
    };
  }

  const confidence = Math.min(100, Math.round(whale.confidence * 0.7 + emergenceSignals.length * 8));

  return {
    wallet: report.address,
    status: whale.classification === "emerging" || whale.classification === "waking" ? "emerging" : "watch",
    confidence,
    reason: `${emergenceSignals.length} accumulation or acceleration signal${emergenceSignals.length === 1 ? "" : "s"} with a rising visible balance trend.`,
    signals: emergenceSignals,
  };
}
