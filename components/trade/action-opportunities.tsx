"use client";

import { ArrowRightLeft, CircleDollarSign } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { ActionDrawer } from "@/components/trade/action-drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getJupiterQuote } from "@/lib/trading/swap-provider";
import type { SignalAction, SwapQuotePreview } from "@/types/signal-action";

function actionLabel(action: SignalAction) {
  const output = action.tokenPair.outputSymbol.toUpperCase();
  const input = action.tokenPair.inputSymbol.toUpperCase();
  if (["USDC", "USDT"].includes(output)) return `Sell ${input}`;
  if (["USDC", "USDT"].includes(input)) return `Buy ${output}`;
  return "Swap";
}

export function ActionOpportunities({ actions }: { actions: SignalAction[] }) {
  const [selected, setSelected] = useState<SignalAction | null>(null);
  const [quotes, setQuotes] = useState<Record<string, SwapQuotePreview>>({});
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const { connected } = useWallet();
  const routableActions = useMemo(() => connected ? actions.filter((action) => quotes[action.id]) : [], [actions, connected, quotes]);

  useEffect(() => {
    if (!connected || !actions.length) {
      return;
    }

    let cancelled = false;
    async function loadRoutes() {
      setLoadingRoutes(true);
      const results = await Promise.all(
        actions.map(async (action) => {
          try {
            return [action.id, await getJupiterQuote(action)] as const;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) return;
      setQuotes(Object.fromEntries(results.filter((result): result is readonly [string, SwapQuotePreview] => Boolean(result))));
      setLoadingRoutes(false);
    }

    void loadRoutes();
    return () => {
      cancelled = true;
    };
  }, [actions, connected]);

  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Action Opportunities</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Jupiter route previews derived only from measured wallet signals.</p>
          </div>
          <div className="grid size-10 place-items-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <CircleDollarSign className="size-5" />
          </div>
        </div>

        <div className="mt-5 rounded-md border border-emerald-300/15 bg-emerald-300/[.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Swap Terminal</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Buy, sell, or swap with Jupiter route preview.</p>
            </div>
            {actions.length > 0 && (
              <Button variant="secondary" onClick={() => setSelected(actions[0])} className="w-full sm:w-auto">
                Preview Evidence Route
              </Button>
            )}
          </div>
          {!connected && <p className="mt-3 text-sm text-slate-400">Connect wallet to execute</p>}
        </div>

        {!connected ? (
          <div className="mt-5 rounded-md border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-slate-400">
            Connect wallet to execute
          </div>
        ) : !routableActions.length ? (
          <div className="mt-5 rounded-md border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-slate-400">
            {actions.length > 0 && loadingRoutes ? "Fetching route..." : "No chain evidence available"}
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {routableActions.map((action) => (
              <div key={action.id} className="rounded-md border border-white/10 bg-white/[.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{action.reason}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-medium text-emerald-100">{actionLabel(action)}</span>
                    {action.tokenPair.inputSymbol}
                    <ArrowRightLeft className="size-4 text-cyan-200" />
                    {action.tokenPair.outputSymbol}
                  </span>
                  <span className="min-w-0 break-words text-sm text-slate-400">{quotes[action.id].routeLabel}</span>
                  <Button variant="secondary" onClick={() => setSelected(action)} className="w-full sm:w-auto">
                    Preview Route
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <ActionDrawer action={selected} quote={selected ? quotes[selected.id] ?? null : null} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </>
  );
}
