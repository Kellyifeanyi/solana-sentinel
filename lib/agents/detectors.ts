import type { GoldRushEventEvidence } from "@/lib/goldrush";
import type { AgentDetection, RiskLevel, WalletReport } from "@/types/sentinel";

function detectionId(wallet: string, type: AgentDetection["type"], marker: string) {
  return `${type}:${wallet}:${marker}`.slice(0, 180);
}

function detection({
  type,
  wallet,
  severity,
  confidence,
  title,
  signals,
  evidence,
  timestamp,
}: Omit<AgentDetection, "id" | "status">): AgentDetection {
  return {
    id: detectionId(wallet, type, `${timestamp}:${signals.join(",")}`),
    type,
    wallet,
    severity,
    confidence,
    title,
    status: "detected",
    signals,
    evidence,
    timestamp,
  };
}

function hasAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function severityFromConfidence(confidence: number): RiskLevel {
  if (confidence >= 85) return "critical";
  if (confidence >= 68) return "high";
  if (confidence >= 45) return "moderate";
  return "low";
}

export function detectDrainerApprovals(report: WalletReport, events: GoldRushEventEvidence[]): AgentDetection[] {
  const approvalEvents = events.filter((event) => {
    const names = event.decodedNames.join(" ");
    return hasAny(names, ["approve", "approval", "setauthority", "set authority"]);
  });

  if (!approvalEvents.length) return [];

  return approvalEvents.slice(0, 4).map((event) => {
    const unknownSpenders = event.senderAddresses.filter((address) => address && address.toLowerCase() !== report.address.toLowerCase());
    const confidence = Math.min(100, 50 + unknownSpenders.length * 12 + (event.successful === false ? 8 : 0));
    const signals = ["suspicious_spender", "approval_abuse"];
    if (confidence >= 74) signals.unshift("drainer_risk_high");

    return detection({
      type: "drainer_approval",
      wallet: report.address,
      severity: severityFromConfidence(confidence),
      confidence,
      title: "Approval Risk Detected",
      signals,
      evidence: [
        `GoldRush decoded approval-like event in transaction ${event.txHash}.`,
        unknownSpenders.length ? `${unknownSpenders.length} non-wallet spender address${unknownSpenders.length === 1 ? "" : "es"} appeared in event logs.` : "Approval-like event appeared in decoded logs.",
      ],
      timestamp: event.timestamp,
    });
  });
}

export function detectLiquidityPulls(report: WalletReport, events: GoldRushEventEvidence[]): AgentDetection[] {
  const lpEvents = events.filter((event) => {
    const names = event.decodedNames.join(" ");
    const symbols = event.senderSymbols.join(" ");
    return hasAny(names, ["remove liquidity", "burn", "withdraw", "decrease liquidity"]) || hasAny(symbols, ["lp"]);
  });

  if (!lpEvents.length) return [];

  const highValue = lpEvents.filter((event) => event.amountUsd >= 50_000);
  if (!highValue.length && lpEvents.length < 2) return [];

  const timestamp = highValue[0]?.timestamp ?? lpEvents[0].timestamp;
  const confidence = Math.min(100, 48 + lpEvents.length * 10 + highValue.length * 16);

  return [detection({
    type: "liquidity_pull",
    wallet: report.address,
    severity: severityFromConfidence(confidence),
    confidence,
    title: "Liquidity Exit Pattern",
    signals: highValue.length ? ["lp_pull_detected", "liquidity_exit_spike"] : ["liquidity_exit_spike"],
    evidence: [
      `${lpEvents.length} LP-removal or liquidity-burn event${lpEvents.length === 1 ? "" : "s"} appeared in GoldRush decoded logs.`,
      highValue.length ? `${highValue.length} liquidity event${highValue.length === 1 ? "" : "s"} crossed 50,000 USD notional.` : "Repeated LP-related events provide the supporting signal.",
    ],
    timestamp,
  })];
}

export function detectPhishingAirdrops(report: WalletReport, events: GoldRushEventEvidence[]): AgentDetection[] {
  const dustBalances = report.balances.filter((balance) => balance.valueUsd > 0 && balance.valueUsd < 1 && balance.amount > 0);
  const inboundMints = events.filter((event) => {
    const names = event.decodedNames.join(" ");
    return hasAny(names, ["mint", "transfer"]) && event.toAddress?.toLowerCase() === report.address.toLowerCase() && event.amountUsd < 1;
  });

  if (inboundMints.length < 2 || dustBalances.length < 3) return [];

  const confidence = Math.min(100, 44 + dustBalances.length * 7 + inboundMints.length * 8);
  const timestamp = inboundMints[0].timestamp;

  return [detection({
    type: "phishing_airdrop",
    wallet: report.address,
    severity: severityFromConfidence(confidence),
    confidence,
    title: "Suspicious Airdrop Pattern",
    signals: ["phishing_airdrop", "suspicious_airdrop"],
    evidence: [
      dustBalances.length ? `${dustBalances.length} sub-dollar token balance${dustBalances.length === 1 ? "" : "s"} are visible in GoldRush balances.` : "No dust balance cluster was visible.",
      `${inboundMints.length} low-value inbound mint/transfer event${inboundMints.length === 1 ? "" : "s"} appeared in decoded logs.`,
    ],
    timestamp,
  })];
}
