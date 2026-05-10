"use client";

import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePremiumInsight } from "@/hooks/use-premium-insight";

export function PremiumInsight({ wallet, evidenceAvailable }: { wallet: string; evidenceAvailable: boolean }) {
  const { loading, insight, requiresPayment, requestInsight } = usePremiumInsight(wallet);

  return (
    <Card className="stat-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Premium x402 Insight</p>
          <p className="mt-1 text-sm text-slate-400">GoldRush evidence summary.</p>
        </div>
        {evidenceAvailable && (
          <Button onClick={requestInsight} disabled={loading} className="shrink-0">
            <ReceiptText className="size-4" />
            {loading ? "Requesting" : "Request x402"}
          </Button>
        )}
      </div>
      {!evidenceAvailable && (
        <p className="mt-4 rounded-md border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-slate-400">No premium insight available.</p>
      )}
      {evidenceAvailable && requiresPayment && <p className="mt-4 text-xs text-cyan-200">402 Payment Required.</p>}
      {insight && <p className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">{insight}</p>}
      {evidenceAvailable && requiresPayment && !loading && !insight && (
        <p className="mt-4 rounded-md border border-white/10 bg-white/[.035] p-4 text-sm leading-6 text-slate-400">No premium insight available.</p>
      )}
    </Card>
  );
}
