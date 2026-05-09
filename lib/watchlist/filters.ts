import type { WalletBalance, WalletTransaction } from "@/types/sentinel";

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PROGRAM_OR_JUNK_LABELS = [
  "program",
  "token program",
  "system program",
  "stake program",
  "vote program",
  "unknown",
  "new mint",
];

export function parseAddressList(value?: string) {
  return value
    ?.split(",")
    .map((address) => address.trim())
    .filter(Boolean) ?? [];
}

export function isLikelySolanaWalletAddress(address: string) {
  return BASE58_ADDRESS.test(address);
}

export function isLikelyProgramOrJunkAddress(address: string) {
  const normalized = address.toLowerCase();
  return PROGRAM_OR_JUNK_LABELS.some((label) => normalized.includes(label)) || !isLikelySolanaWalletAddress(address);
}

export function isLikelyRealWallet({
  address,
  balances,
  transactions,
}: {
  address: string;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
}) {
  if (isLikelyProgramOrJunkAddress(address)) return false;
  if (!balances.length && transactions.length < 2) return false;

  const totalValue = balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const meaningfulTransactions = transactions.filter((transaction) => transaction.amountUsd > 0 || transaction.type !== "transfer");
  const uniqueCounterparties = new Set(
    transactions
      .map((transaction) => transaction.counterparty)
      .filter((counterparty) => counterparty && !isLikelyProgramOrJunkAddress(counterparty)),
  );

  if (totalValue <= 0 && meaningfulTransactions.length < 2) return false;
  if (transactions.length >= 4 && uniqueCounterparties.size === 0) return false;

  return true;
}

export function uniqueWalletCandidates(addresses: string[]) {
  return Array.from(new Set(addresses.filter((address) => isLikelySolanaWalletAddress(address))));
}
