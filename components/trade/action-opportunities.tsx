"use client";

import { ArrowRightLeft, CircleDollarSign } from "lucide-react";
import { useState } from "react";
import { ActionDrawer } from "@/components/trade/action-drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SignalAction } from "@/types/signal-action";

export function ActionOpportunities({ actions }: { actions: SignalAction[] }) {
  const [selected, setSelected] = useState<SignalAction | null>(null);

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

        {!actions.length ? (
          <div className="mt-5 rounded-md border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-slate-400">
            No actionable signals detected. Monitoring wallet activity for evidence-backed opportunities.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {actions.map((action) => (
              <div key={action.id} className="rounded-md border border-white/10 bg-white/[.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{action.reason}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs uppercase text-cyan-100">
                    {action.confidence}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                    {action.tokenPair.inputSymbol}
                    <ArrowRightLeft className="size-4 text-cyan-200" />
                    {action.tokenPair.outputSymbol}
                  </span>
                  <Button variant="secondary" onClick={() => setSelected(action)} className="w-full sm:w-auto">
                    Preview Route
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <ActionDrawer action={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </>
  );
}
