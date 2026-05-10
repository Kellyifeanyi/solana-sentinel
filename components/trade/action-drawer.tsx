"use client";

import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { executeJupiterSwap, getJupiterQuote } from "@/lib/trading/swap-provider";
import type { SignalAction, SwapQuotePreview } from "@/types/signal-action";

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
    if (!open || !action || !connected) return;
    let cancelled = false;
    const currentAction = action;

    async function loadQuote() {
      setQuote(initialQuote);
      setStatus(null);
      if (initialQuote) return;
      setLoadingQuote(true);
      try {
        const nextQuote = await getJupiterQuote(currentAction);
        if (!cancelled) setQuote(nextQuote);
      } catch {
        if (!cancelled) setStatus(null);
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
    if (!action || !quote || !publicKey || !signTransaction) return;
    setExecuting(true);
    setStatus("Awaiting wallet confirmation...");
    try {
      const signature = await executeJupiterSwap({
        quote: quote.rawQuote,
        publicKey: publicKey.toBase58(),
        signTransaction,
        connection,
      });
      setStatus(`Swap submitted: ${signature}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Swap execution failed.");
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
            {loadingQuote && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="size-4 animate-spin" /> Fetching Jupiter route...</p>}
            {!loadingQuote && quote && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Input</span><span className="numeric text-white">{quote.inputAmount} {action.tokenPair.inputSymbol}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Estimated output</span><span className="numeric text-white">{quote.outputAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {action.tokenPair.outputSymbol}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Route</span><span className="text-right text-white">{quote.routeLabel}</span></div>
              </div>
            )}
            {!loadingQuote && !quote && <p className="text-sm text-slate-400">No route available.</p>}
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
            <Button onClick={execute} disabled={!quote || executing} className="w-full">
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
