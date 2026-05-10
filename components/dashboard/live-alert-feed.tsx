"use client";

import { ArrowRightLeft, BadgeAlert, CircleAlert, RadioTower, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { compactAddress, formatRelativeTime, formatUsd } from "@/lib/utils";
import type { AlertKind, SentinelAlert } from "@/types/sentinel";

const icon: Record<AlertKind, typeof RadioTower> = {
  accumulation_burst: TrendingUp,
  dex_activity_spike: ArrowRightLeft,
  suspicious_transfer_surge: CircleAlert,
  large_transfer: RadioTower,
  dex_activity: ArrowRightLeft,
  suspicious_movement: BadgeAlert,
  agent_detection: BadgeAlert,
};

function severityAccent(severity: SentinelAlert["severity"]) {
  return {
    critical: "border-l-rose-300 bg-rose-300/[.035]",
    high: "border-l-amber-300 bg-amber-300/[.025]",
    moderate: "border-l-cyan-300 bg-cyan-300/[.02]",
    low: "border-l-white/20 bg-white/[.015]",
  }[severity];
}

function absoluteTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export function LiveAlertFeed({ alerts, animated = false }: { alerts: SentinelAlert[]; animated?: boolean }) {
  const [streamedAlerts, setStreamedAlerts] = useState<SentinelAlert[]>(alerts);
  const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "reconnecting" | "offline">(alerts.length ? "live" : "connecting");
  const [updatedAt, setUpdatedAt] = useState<string | null>(alerts[0]?.timestamp ?? null);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const source = new EventSource("/api/stream");

    source.addEventListener("status", (event) => {
      try {
        const payload = JSON.parse(event.data) as { status?: "live" | "idle"; updatedAt?: string };
        setStreamStatus(payload.status === "live" ? "live" : "connecting");
        setUpdatedAt(payload.updatedAt ?? new Date().toISOString());
      } catch {
        setStreamStatus("reconnecting");
      }
    });

    source.addEventListener("alert", (event) => {
      try {
        const payload = JSON.parse(event.data) as { alert?: SentinelAlert; updatedAt?: string };
        const alert = payload.alert;
        if (!alert) return;
        setUpdatedAt(payload.updatedAt ?? alert.timestamp);
        setStreamStatus("live");
        setStreamedAlerts((current) => {
          const next = [alert, ...current];
          return Array.from(new Map(next.map((alert) => [`${alert.id}:${alert.wallet}:${alert.timestamp}:${alert.kind}`, alert])).values()).slice(0, 16);
        });
      } catch {
        setStreamStatus("reconnecting");
      }
    });

    source.onerror = () => {
      setStreamStatus("reconnecting");
      window.setTimeout(() => {
        if (source.readyState === EventSource.CLOSED) setStreamStatus("offline");
      }, 8000);
    };

    return () => source.close();
  }, [alerts.length]);

  const rows = streamedAlerts;
  const statusLabel = {
    connecting: "Connecting...",
    live: "Live",
    reconnecting: "Reconnecting...",
    offline: "Offline (fallback mode)",
  }[streamStatus];
  const statusClass = streamStatus === "live"
    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
    : "border-white/10 bg-white/[.06] text-slate-300";
  const updatedLabel = useMemo(() => updatedAt ? formatRelativeTime(updatedAt) : null, [updatedAt]);

  return (
    <Card className="overflow-hidden border-cyan-300/15 bg-slate-950/80 shadow-[0_24px_100px_rgba(8,47,73,.3)]">
      <div className="terminal-grid flex flex-col gap-3 border-b border-white/10 bg-white/[.025] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Live Alert Tape</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">GoldRush transaction alerts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updatedLabel && <span className="text-xs text-slate-500">Updated {updatedLabel}</span>}
          <span className={`w-fit rounded-md border px-2 py-1 text-xs font-medium shadow-[0_0_28px_rgba(16,185,129,.08)] ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>
      {!rows.length && (
        <div className="p-4 sm:p-5">
          <div className="rounded-md border border-white/10 bg-white/[.035] p-5 text-sm leading-6 text-slate-300">
            No alerts available.
          </div>
        </div>
      )}
      <div className={animated ? "max-h-[620px] overflow-y-auto" : ""}>
        <div>
          {rows.map((alert, index) => {
            const Icon = icon[alert.kind];
            const alertId = alert.id?.trim();
            const safeAlertId = alertId && alertId.toUpperCase() !== "UNKNOWN" ? alertId : undefined;
            const alertKey = safeAlertId
              ? `${safeAlertId}-${alert.wallet}-${alert.timestamp}-${index}`
              : `${alert.wallet || "unknown"}-${alert.timestamp}-${index}`;

            return (
              <div key={alertKey} className={`group grid gap-3 border-b border-l-2 border-b-white/5 p-4 transition duration-200 last:border-b-0 hover:bg-white/[.045] sm:grid-cols-[auto_1fr_auto] sm:gap-4 ${severityAccent(alert.severity)}`}>
                <div className="grid size-9 shrink-0 place-items-center rounded-md border border-cyan-300/15 bg-cyan-300/[.08] text-cyan-200 transition group-hover:border-cyan-300/35 group-hover:text-cyan-100">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{alert.title ?? "GoldRush Alert"}</span>
                    <RiskBadge level={alert.severity} />
                    {alert.group && <span className="rounded-md bg-white/[.06] px-2 py-0.5 text-xs text-slate-300">{alert.group}</span>}
                  </div>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-300">
                    {alert.summary ?? `${compactAddress(alert.wallet)} via ${alert.venue}`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="numeric text-slate-300">{alert.amountUsd > 0 ? formatUsd(alert.amountUsd) : "Unpriced"}</span>
                    <span>{alert.token}</span>
                    <span>{compactAddress(alert.wallet)}</span>
                    {safeAlertId && <span>Tx {compactAddress(safeAlertId, 6)}</span>}
                    <span>{alert.sourceLabel ?? alert.venue}</span>
                  </div>
                  {alert.reason && <p className="mt-2 break-words text-xs leading-5 text-slate-500">{alert.reason}</p>}
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <time dateTime={alert.timestamp} className="shrink-0 text-xs text-slate-500">{formatRelativeTime(alert.timestamp)}</time>
                  <p className="mt-1 hidden text-[11px] text-slate-600 sm:block">{absoluteTime(alert.timestamp)}</p>
                  <span className="rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-xs text-slate-400 sm:mt-2 sm:inline-block">
                    {alert.venue}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
