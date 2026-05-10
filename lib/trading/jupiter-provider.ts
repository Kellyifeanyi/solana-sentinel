import { createJupiterApiClient, type QuoteResponse } from "@jup-ag/api";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { TRADE_TOKENS } from "@/lib/trading/tokens";
import type { SignalAction, SwapQuotePreview } from "@/types/signal-action";

const jupiter = createJupiterApiClient();
const SWAP_TRANSACTION_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const SPEND_MINTS = new Set<string>([TRADE_TOKENS.SOL.mint, TRADE_TOKENS.USDC.mint]);
const SOLANA_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const usedSwapTransactions = new Set<string>();

type RouteClassification =
  | "VALID_ROUTE"
  | "NO_LIQUIDITY_ROUTE"
  | "INVALID_PAIR_ROUTE"
  | "STALE_QUOTE_ROUTE"
  | "MINT_MISMATCH_ROUTE"
  | "AMOUNT_INVALID_ROUTE"
  | "UNKNOWN_FAILURE_ROUTE";

const ROUTE_MESSAGES: Record<Exclude<RouteClassification, "VALID_ROUTE">, string> = {
  NO_LIQUIDITY_ROUTE: "No liquidity for pair",
  INVALID_PAIR_ROUTE: "Token pair not supported",
  STALE_QUOTE_ROUTE: "Route expired",
  MINT_MISMATCH_ROUTE: "Mint mismatch",
  AMOUNT_INVALID_ROUTE: "Amount exceeds liquidity",
  UNKNOWN_FAILURE_ROUTE: "Unknown routing failure",
};

function toAtomicAmount(amount: number, decimals: number) {
  return Math.max(1, Math.round(amount * 10 ** decimals));
}

function fromAtomicAmount(amount: string | number | undefined, decimals: number) {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? value / 10 ** decimals : 0;
}

function routeLabel(quote: QuoteResponse) {
  const labels = quote.routePlan
    ?.map((step) => step.swapInfo?.label)
    .filter(Boolean);
  return labels?.length ? labels.join(" -> ") : "Jupiter route";
}

function base64ToBytes(value: string) {
  if (!value || !SWAP_TRANSACTION_BASE64.test(value)) {
    throw new Error("INVALID_TRANSACTION");
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function classifyQuoteRoute(quote: unknown, action: SignalAction): RouteClassification {
  const route = quote as Partial<QuoteResponse> | null;
  const expectedAmount = toAtomicAmount(action.tokenPair.amount, action.tokenPair.inputDecimals).toString();

  if (!route) return "UNKNOWN_FAILURE_ROUTE";
  if (action.tokenPair.amount <= 0 || !Number.isFinite(action.tokenPair.amount)) return "AMOUNT_INVALID_ROUTE";
  if (
    typeof route.inputMint !== "string" ||
    typeof route.outputMint !== "string" ||
    route.inputMint !== action.tokenPair.inputMint ||
    route.outputMint !== action.tokenPair.outputMint
  ) {
    return "MINT_MISMATCH_ROUTE";
  }
  if (!SPEND_MINTS.has(route.inputMint) || !SOLANA_MINT.test(route.outputMint) || route.inputMint === route.outputMint) {
    return "INVALID_PAIR_ROUTE";
  }
  if (route.inAmount !== expectedAmount) return "AMOUNT_INVALID_ROUTE";
  if (!Array.isArray(route.routePlan) || route.routePlan.length === 0) return "NO_LIQUIDITY_ROUTE";
  if (!route.outAmount || Number(route.outAmount) <= 0) return "NO_LIQUIDITY_ROUTE";
  return "VALID_ROUTE";
}

function classifyJupiterError(error: unknown): Exclude<RouteClassification, "VALID_ROUTE"> {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("not tradable") || message.includes("not supported") || message.includes("invalid mint")) return "INVALID_PAIR_ROUTE";
  if (message.includes("route expired") || message.includes("blockhash not found") || message.includes("expired")) return "STALE_QUOTE_ROUTE";
  if (message.includes("amount") || message.includes("liquidity") || message.includes("consume all the amount")) return "AMOUNT_INVALID_ROUTE";
  if (message.includes("no route") || message.includes("could not find") || message.includes("not enough")) return "NO_LIQUIDITY_ROUTE";
  return "UNKNOWN_FAILURE_ROUTE";
}

function routeError(classification: Exclude<RouteClassification, "VALID_ROUTE">) {
  return new Error(ROUTE_MESSAGES[classification]);
}

async function fetchValidatedQuote(action: SignalAction): Promise<QuoteResponse> {
  if (!SPEND_MINTS.has(action.tokenPair.inputMint) || !SOLANA_MINT.test(action.tokenPair.outputMint) || action.tokenPair.inputMint === action.tokenPair.outputMint) {
    throw routeError("INVALID_PAIR_ROUTE");
  }
  if (action.tokenPair.amount <= 0 || !Number.isFinite(action.tokenPair.amount)) {
    throw routeError("AMOUNT_INVALID_ROUTE");
  }

  const amount = toAtomicAmount(action.tokenPair.amount, action.tokenPair.inputDecimals);
  let lastFailure: Exclude<RouteClassification, "VALID_ROUTE"> = "UNKNOWN_FAILURE_ROUTE";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const quote = await jupiter.quoteGet({
        inputMint: action.tokenPair.inputMint,
        outputMint: action.tokenPair.outputMint,
        amount,
        slippageBps: 50,
      });
      const classification = classifyQuoteRoute(quote, action);
      if (classification === "VALID_ROUTE") return quote;
      lastFailure = classification as Exclude<RouteClassification, "VALID_ROUTE">;
    } catch (error) {
      lastFailure = classifyJupiterError(error);
    }
  }

  throw routeError(lastFailure);
}

export async function getJupiterQuote(action: SignalAction): Promise<SwapQuotePreview> {
  const quote = await fetchValidatedQuote(action);

  return {
    inputAmount: fromAtomicAmount(quote.inAmount, action.tokenPair.inputDecimals),
    outputAmount: fromAtomicAmount(quote.outAmount, action.tokenPair.outputDecimals),
    priceImpactPct: Number(quote.priceImpactPct ?? 0),
    routeLabel: routeLabel(quote),
    rawQuote: quote,
  };
}

export async function executeJupiterSwap({
  action,
  publicKey,
  signTransaction,
  connection,
  paymentVerified,
}: {
  action: SignalAction;
  publicKey: string;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  connection: Connection;
  paymentVerified: boolean;
}) {
  if (!publicKey || !signTransaction) {
    throw new Error("Wallet not ready");
  }
  if (!paymentVerified) {
    throw new Error("Payment verification failed");
  }

  const quote = await fetchValidatedQuote(action);

  let swap: Awaited<ReturnType<typeof jupiter.swapPost>>;
  try {
    swap = await jupiter.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: publicKey,
        dynamicComputeUnitLimit: true,
      },
    });
  } catch (error) {
    const classification = classifyJupiterError(error);
    if (classification === "STALE_QUOTE_ROUTE") throw routeError("STALE_QUOTE_ROUTE");
    throw new Error("Swap failed safely");
  }

  if (!swap.swapTransaction) {
    throw new Error("Swap failed safely");
  }
  if (usedSwapTransactions.has(swap.swapTransaction)) {
    throw new Error("INVALID_TRANSACTION");
  }
  usedSwapTransactions.add(swap.swapTransaction);

  let transaction: VersionedTransaction;
  try {
    transaction = VersionedTransaction.deserialize(base64ToBytes(swap.swapTransaction));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TRANSACTION") throw error;
    throw new Error("INVALID_TRANSACTION");
  }
  if (!transaction) {
    throw new Error("Swap failed safely");
  }

  try {
    const latest = await connection.getLatestBlockhash("finalized");
    if (!latest.blockhash || !Number.isFinite(latest.lastValidBlockHeight)) {
      throw new Error("Swap failed safely");
    }
    transaction.message.recentBlockhash = latest.blockhash;
    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    if (!signature) {
      throw new Error("Swap failed safely");
    }
    await connection.confirmTransaction({
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    }, "finalized");
    return signature;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("reject") || message.includes("cancel") || message.includes("denied")) {
      throw new Error("Transaction cancelled");
    }
    throw new Error("Swap failed safely");
  }
}
