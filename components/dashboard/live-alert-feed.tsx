import { ArrowRightLeft, BadgeAlert, BellPlus, CircleAlert, RadioTower, Radar, ShieldAlert, TrendingUp } from "lucide-react";
import { RiskBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { compactAddress, formatRelativeTime, formatUsd } from "@/lib/utils";
import type { AlertKind, WhaleAlert } from "@/types/sentinel";

const icon: Record<AlertKind, typeof RadioTower> = {
  whale_emergence: Radar,
  accumulation_burst: TrendingUp,
  dex_activity_spike: ArrowRightLeft,
  risk_profile_changed: ShieldAlert,
  new_watchlist_wallet: BellPlus,
  activity_cluster_burst: TrendingUp,
  dormant_to_active: RadioTower,
  suspicious_transfer_surge: CircleAlert,
  large_transfer: RadioTower,
  dex_activity: ArrowRightLeft,
  suspicious_movement: BadgeAlert,
};

export function LiveAlertFeed({ alerts, animated = false }: { alerts: WhaleAlert[]; animated?: boolean }) {
  const rows = animated && alerts.length > 0 ? [...alerts, ...alerts] : alerts;

  return (
    <Card className="overflow-hidden border-cyan-300/15 bg-slate-950/80 shadow-[0_24px_100px_rgba(8,47,73,.3)]">
      <div className="terminal-grid flex flex-col gap-3 border-b border-white/10 bg-white/[.025] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Breaking Intelligence Feed</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">Whale emergence, accumulation bursts, DEX spikes, and risk changes.</p>
        </div>
        <span className="w-fit rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-medium text-emerald-100 shadow-[0_0_28px_rgba(16,185,129,.12)]">
          LIVE
        </span>
      </div>
      {!alerts.length && (
        <div className="p-4 sm:p-5">
          <div className="rounded-md border border-white/10 bg-white/[.035] p-5 text-sm leading-6 text-slate-300">
            No breaking GoldRush alerts are available yet. Sentinel will auto-scan recent GoldRush activity, or you can add `SENTINEL_WATCHLIST` for specific wallets.
          </div>
        </div>
      )}
      <div className={animated ? "max-h-[520px] overflow-hidden" : ""}>
        <div className={animated ? "animate-feed" : ""}>
          {rows.map((alert, index) => {
            const Icon = icon[alert.kind];
            const alertId = alert.id?.trim();
            const safeAlertId = alertId && alertId.toUpperCase() !== "UNKNOWN" ? alertId : undefined;
            const alertKey = safeAlertId
              ? `${safeAlertId}-${alert.wallet}-${alert.timestamp}-${index}`
              : `${alert.wallet || "unknown"}-${alert.timestamp}-${index}`;

            return (
              <div key={alertKey} className="group grid gap-3 border-b border-white/5 p-4 transition duration-200 last:border-b-0 hover:bg-white/[.045] sm:grid-cols-[auto_1fr_auto] sm:gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-cyan-300/15 bg-cyan-300/[.08] text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,.12)] transition group-hover:border-cyan-300/35 group-hover:text-cyan-100">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{alert.title ?? "Wallet Activity Alert"}</span>
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
                    <span>{alert.sourceLabel ?? alert.venue}</span>
                  </div>
                  {alert.reason && <p className="mt-2 break-words text-xs leading-5 text-slate-500">{alert.reason}</p>}
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <span className="shrink-0 text-xs text-slate-500">{formatRelativeTime(alert.timestamp)}</span>
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
