"use client";

import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { executeJupiterSwap, getJupiterQuote } from "@/lib/trading/swap-provider";
import type { SignalAction, SwapQuotePreview } from "@/types/signal-action";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const usedPaymentSignatures = new Set<string>();

type X402Accept = {
  scheme?: "x402";
  asset?: "USDC";
  amount?: string;
  unit?: "micro-USDC";
  network?: "solana-mainnet";
  destination?: string;
};

type SignTransaction = <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;

function associatedTokenAddress(owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function u64Le(value: number) {
  const bytes = new Uint8Array(8);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
}

function createAssociatedTokenAccountInstruction(payer: PublicKey, owner: PublicKey) {
  const ata = associatedTokenAddress(owner);
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function createTransferCheckedInstruction(source: PublicKey, destination: PublicKey, owner: PublicKey, amountMicros: number) {
  const data = new Uint8Array(10);
  data[0] = 12;
  data.set(u64Le(amountMicros), 1);
  data[9] = 6;

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: USDC_MINT, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function paymentHeader(signature: string, accept: X402Accept) {
  return JSON.stringify({
    scheme: "x402",
    network: "solana-mainnet",
    asset: "USDC",
    signature,
    amount: accept.amount,
    destination: accept.destination,
  });
}

async function ensureX402Payment({
  connection,
  publicKey,
  signTransaction,
}: {
  connection: ReturnType<typeof useConnection>["connection"];
  publicKey: PublicKey;
  signTransaction: SignTransaction;
}) {
  const challenge = await fetch("/api/x402", { cache: "no-store" });
  if (challenge.ok) {
    const payload = (await challenge.json()) as { enabled?: boolean; status?: string };
    if (payload.enabled === false || payload.status === "verified") return;
    throw new Error("Payment verification failed");
  }
  if (challenge.status !== 402) {
    throw new Error("Payment verification failed");
  }

  const payload = (await challenge.json()) as { accepts?: X402Accept[] };
  const accept = payload.accepts?.[0];
  const amountMicros = Number(accept?.amount);
  if (
    accept?.scheme !== "x402" ||
    accept.asset !== "USDC" ||
    accept.unit !== "micro-USDC" ||
    accept.network !== "solana-mainnet" ||
    !accept.destination ||
    !Number.isInteger(amountMicros) ||
    amountMicros <= 0
  ) {
    throw new Error("Payment verification failed");
  }

  const destinationOwner = new PublicKey(accept.destination);
  const sourceAta = associatedTokenAddress(publicKey);
  const destinationAta = associatedTokenAddress(destinationOwner);
  const latest = await connection.getLatestBlockhash("finalized");
  if (!latest.blockhash || !Number.isFinite(latest.lastValidBlockHeight)) {
    throw new Error("Payment verification failed");
  }

  const transaction = new Transaction({
    feePayer: publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(
    createAssociatedTokenAccountInstruction(publicKey, destinationOwner),
    createTransferCheckedInstruction(sourceAta, destinationAta, publicKey, amountMicros),
  );

  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  if (!signature || usedPaymentSignatures.has(signature)) {
    throw new Error("Payment verification failed");
  }
  await connection.confirmTransaction({ signature, ...latest }, "finalized");
  usedPaymentSignatures.add(signature);

  const verified = await fetch("/api/x402", {
    method: "POST",
    headers: {
      "X-Payment": paymentHeader(signature, accept),
    },
  });
  if (!verified.ok) {
    throw new Error("Payment verification failed");
  }
}

export function ActionDrawer({
  action,
  quote: initialQuote,
  open,
  onClose,
}: {
  action: SignalAction | null;
  quote: SwapQuotePreview | null;
  open: boolean;
  onClose: () => void;
}) {
  const { connection } = useConnection();
  const { connected, publicKey, signTransaction } = useWallet();
  const [quote, setQuote] = useState<SwapQuotePreview | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !action) return;
    let cancelled = false;
    const currentAction = action;

    async function loadQuote() {
      setQuote(initialQuote);
      setStatus("Scanning GoldRush data...");
      if (!connected) {
        setStatus("Confirm in wallet...");
        return;
      }
      setStatus("Computing whale score...");
      if (initialQuote) return;
      setLoadingQuote(true);
      try {
        setStatus("Fetching best route...");
        const nextQuote = await getJupiterQuote(currentAction);
        if (!cancelled) {
          setQuote(nextQuote);
          setStatus(null);
        }
      } catch {
        if (!cancelled) setStatus("No chain evidence available");
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    }

    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [action, connected, initialQuote, open]);

  async function execute() {
    if (!action) return;
    if (!connected || !publicKey || !signTransaction) {
      setStatus("Wallet not ready");
      return;
    }
    setExecuting(true);
    setStatus("Verifying payment...");
    try {
      await ensureX402Payment({ connection, publicKey, signTransaction });
      setStatus("Fetching fresh route...");
      const signature = await executeJupiterSwap({
        action,
        publicKey: publicKey.toBase58(),
        signTransaction,
        connection,
        paymentVerified: true,
      });
      setStatus(`Swap confirmed: ${signature}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Swap failed safely");
    } finally {
      setExecuting(false);
    }
  }

  if (!open || !action) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close action drawer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-lg border border-white/10 bg-slate-950 p-5 shadow-2xl shadow-black/50 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Jupiter Execution</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{action.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-md border border-white/10 text-slate-300 hover:bg-white/[.07] hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">{action.reason}</div>

        <div className="mt-5 grid gap-3">
          <Info label="Suggested action" value={action.suggestedAction} />
          <Info label="Slippage" value="0.50%" />
        </div>

        <div className="mt-5 rounded-md border border-white/10 bg-white/[.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-white">{action.tokenPair.inputSymbol}</span>
            <ArrowRightLeft className="size-4 text-cyan-200" />
            <span className="text-sm font-medium text-white">{action.tokenPair.outputSymbol}</span>
          </div>
          <div className="mt-4 rounded-md border border-white/10 bg-slate-950/50 p-3">
            {loadingQuote && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="size-4 animate-spin" /> Fetching route...</p>}
            {!loadingQuote && quote && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Input</span><span className="numeric text-white">{quote.inputAmount} {action.tokenPair.inputSymbol}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Estimated output</span><span className="numeric text-white">{quote.outputAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {action.tokenPair.outputSymbol}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Route</span><span className="text-right text-white">{quote.routeLabel}</span></div>
              </div>
            )}
            {!loadingQuote && !quote && <p className="text-sm text-slate-400">No chain evidence available</p>}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Supporting signals</p>
          <div className="mt-3 space-y-2">
            {action.supportingSignals.map((signal) => (
              <p key={signal} className="rounded-md border border-white/10 bg-white/[.03] p-3 text-sm leading-6 text-slate-300">{signal}</p>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!connected ? (
            <>
              <ConnectWalletButton />
              <p className="text-sm text-slate-400">Connect wallet to execute</p>
            </>
          ) : (
            <Button onClick={execute} disabled={executing} className="w-full">
              {executing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
              {executing ? "Executing" : "Execute with Jupiter"}
            </Button>
          )}
        </div>
        {status && <p className="mt-4 break-words rounded-md border border-white/10 bg-white/[.035] p-3 text-sm leading-6 text-slate-300">{status}</p>}
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[.035] p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-white">{value}</p>
    </div>
  );
}
