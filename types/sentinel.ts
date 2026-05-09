export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type EvidenceConfidence = "low" | "moderate" | "high";

export type AlertKind =
  | "whale_emergence"
  | "accumulation_burst"
  | "dex_activity_spike"
  | "risk_profile_changed"
  | "new_watchlist_wallet"
  | "activity_cluster_burst"
  | "dormant_to_active"
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
  timestamp: string;
  risk: RiskLevel;
};

export type SuspiciousToken = {
  symbol: string;
  reason: string;
  severity: RiskLevel;
  exposureUsd: number;
  confidence: EvidenceConfidence;
  evidence: string[];
};

export type WhaleAlert = {
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

export type AutoWatchlistEntry = {
  address: string;
  score: number;
  reason: string;
  labels: string[];
};

export type AutoWatchlistResult = {
  wallets: AutoWatchlistEntry[];
  source: "goldrush" | "empty";
  reason?: string;
};

export type AutoDetectionStage = "dormant" | "waking up" | "emerging" | "active" | "whale-like";

export type AutoWhaleDetection = {
  address: string;
  score: number;
  stage: AutoDetectionStage;
  reason: string;
  signals: string[];
};

export type ActivityScanResult = {
  detections: AutoWhaleDetection[];
  source: "goldrush" | "empty";
  reason?: string;
};

export type WhaleEmergenceStage = "dormant" | "waking up" | "emerging" | "active whale candidate" | "whale-like";

export type WhaleEmergenceSignal = {
  label: string;
  value: string;
  weight: number;
};

export type WhaleEmergence = {
  address: string;
  emergenceScore: number;
  stage: WhaleEmergenceStage;
  signals: WhaleEmergenceSignal[];
  whyItMatters: string;
};

export type RiskSignals = {
  suspiciousTokens: SuspiciousToken[];
  concentrationScore: number;
  transferBehaviorScore: number;
  volatilityExposureScore: number;
  transactionFrequencyScore: number;
  whaleIndicators: string[];
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
  alerts: WhaleAlert[];
  source: "goldrush" | "fallback" | "empty";
  reason?: string;
};
