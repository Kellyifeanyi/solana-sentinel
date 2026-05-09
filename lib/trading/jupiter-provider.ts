import { createJupiterApiClient, type QuoteResponse } from "@jup-ag/api";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { SignalAction, SwapQuotePreview } from "@/types/signal-action";

const jupiter = createJupiterApiClient();

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
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function getJupiterQuote(action: SignalAction): Promise<SwapQuotePreview> {
  const quote = await jupiter.quoteGet({
    inputMint: action.tokenPair.inputMint,
    outputMint: action.tokenPair.outputMint,
    amount: toAtomicAmount(action.tokenPair.amount, action.tokenPair.inputDecimals),
    slippageBps: 50,
  });

  return {
    inputAmount: fromAtomicAmount(quote.inAmount, action.tokenPair.inputDecimals),
    outputAmount: fromAtomicAmount(quote.outAmount, action.tokenPair.outputDecimals),
    priceImpactPct: Number(quote.priceImpactPct ?? 0),
    routeLabel: routeLabel(quote),
    rawQuote: quote,
  };
}

export async function executeJupiterSwap({
  quote,
  publicKey,
  signTransaction,
  connection,
}: {
  quote: unknown;
  publicKey: string;
  signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
  connection: Connection;
}) {
  const swap = await jupiter.swapPost({
    swapRequest: {
      quoteResponse: quote as QuoteResponse,
      userPublicKey: publicKey,
      dynamicComputeUnitLimit: true,
    },
  });

  if (!swap.swapTransaction) {
    throw new Error("Jupiter did not return a swap transaction.");
  }

  const transaction = VersionedTransaction.deserialize(base64ToBytes(swap.swapTransaction));
  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
