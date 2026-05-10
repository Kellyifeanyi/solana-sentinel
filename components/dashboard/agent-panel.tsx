import { Bot, ShieldAlert } from "lucide-react";
import { RiskBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { compactAddress, formatRelativeTime } from "@/lib/utils";
import type { AgentDetection } from "@/types/sentinel";

export function AgentPanel({ detections, status }: { detections: AgentDetection[]; status: "active" | "insufficient evidence" }) {
  return (
    <Card className="overflow-hidden">
      <div className="terminal-grid flex flex-col gap-3 border-b border-white/10 bg-white/[.025] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">AI Agent Command Center</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">GoldRush-backed threat detections.</p>
          </div>
        </div>
        <span className="w-fit rounded-md border border-white/10 bg-white/[.06] px-2 py-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          {status}
        </span>
      </div>

      {!detections.length ? (
        <div className="p-4 sm:p-5">
          <div className="rounded-md border border-white/10 bg-white/[.035] p-5 text-sm leading-6 text-slate-300">
            No agent detections with sufficient evidence.
          </div>
        </div>
      ) : (
        <div className="grid gap-0">
          {detections.map((detection) => (
            <div key={detection.id} className="grid gap-3 border-b border-white/5 p-4 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:gap-4">
              <div className="grid size-9 shrink-0 place-items-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                <ShieldAlert className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">{detection.title}</p>
                  <RiskBadge level={detection.severity} />
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-300">{detection.signals.join(", ")}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {detection.evidence.map((line) => (
                    <p key={`${detection.id}-${line}`} className="break-words rounded-md border border-white/10 bg-white/[.03] px-3 py-2 text-xs leading-5 text-slate-500">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                <span className="text-xs text-slate-500">{compactAddress(detection.wallet)}</span>
                <p className="mt-1 text-xs text-slate-600">{formatRelativeTime(detection.timestamp)}</p>
                <span className="rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-xs text-slate-400 sm:mt-2 sm:inline-block">
                  {detection.confidence}/100
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
