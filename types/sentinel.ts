export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type AlertKind =
  | "accumulation_burst"
  | "dex_activity_spike"
  | "suspicious_transfer_surge"
  | "large_transfer"
  | "dex_activity"
  | "suspicious_movement";

export type WalletBalance = {
  symbol: string;
  name: string;
  amount: number;
  valueUsd: number;
  change24h: number;
  risk: RiskLevel;
  concentration: number;
};

export type WalletTransaction = {
  id: string;
  type: "transfer" | "swap" | "mint" | "burn" | "bridge";
  token: string;
  amountUsd: number;
  counterparty: string;
  fromAddress?: string;
  toAddress?: string;
  direction?: "inbound" | "outbound" | "self" | "unknown";
  timestamp: string;
  risk: RiskLevel;
};

export type SuspiciousToken = {
  symbol: string;
  reason: string;
  severity: RiskLevel;
  exposureUsd: number;
  evidence: string[];
};

export type SentinelAlert = {
  id: string;
  kind: AlertKind;
  wallet: string;
  token: string;
  amountUsd: number;
  venue: string;
  timestamp: string;
  severity: RiskLevel;
  title?: string;
  summary?: string;
  reason?: string;
  sourceLabel?: string;
  group?: string;
};

export type RiskSignals = {
  suspiciousTokens: SuspiciousToken[];
  concentrationScore: number;
  transferBehaviorScore: number;
  volatilityExposureScore: number;
  transactionFrequencyScore: number;
  highValueIndicators: string[];
};

export type WalletReport = {
  address: string;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
  signals: RiskSignals;
  score: number;
  level: RiskLevel;
  recommendations: string[];
  source: "goldrush" | "fallback";
};

export type AlertFeed = {
  alerts: SentinelAlert[];
  source: "goldrush" | "fallback" | "empty";
  reason?: string;
};
