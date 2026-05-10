import Link from "next/link";
import { ArrowLeft, RadioTower, ShieldAlert, TrendingUp } from "lucide-react";
import { AgentPanel } from "@/components/dashboard/agent-panel";
import { LiveAlertFeed } from "@/components/dashboard/live-alert-feed";
import { Card } from "@/components/ui/card";
import { MobileNav } from "@/components/mobile-nav";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { monitorAgentWatchlist } from "@/lib/agents/monitor";
import { buildAgentAlert, getLiveAlertFeedForAddresses } from "@/lib/goldrush";
import { formatUsd } from "@/lib/utils";
import { generateWatchlist } from "@/lib/watchlist/generate";

export default async function AlertsPage() {
  const watchlist = await generateWatchlist();
  const wallets = watchlist.wallets.map((wallet) => wallet.address);
  const [feed, agents] = wallets.length
    ? await Promise.all([getLiveAlertFeedForAddresses(wallets), monitorAgentWatchlist(wallets)])
    : [{ alerts: [], source: "empty" as const, reason: watchlist.reason }, { status: "insufficient evidence" as const, detections: [], reason: watchlist.reason }];
  const alerts = [...feed.alerts, ...agents.detections.map(buildAgentAlert)];
  const notional = alerts.reduce((sum, alert) => sum + alert.amountUsd, 0);

  return (
    <main className="sentinel-shell min-h-screen">
      <div className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <nav className="animate-rise flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[.06] text-slate-300 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:text-white">
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Sentinel stream</p>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Live Alerts</h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <ConnectWalletButton compact />
            <div className="flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100 shadow-[0_0_36px_rgba(16,185,129,.12)]">
              <RadioTower className="size-4" />
              GoldRush
            </div>
          </div>
          <MobileNav />
        </nav>

        <section className="animate-rise-delay mt-8 grid gap-4 md:grid-cols-3">
          <AlertStat label="Tracked Notional" value={formatUsd(notional)} detail="Observed transfer value" icon={TrendingUp} />
          <AlertStat label="Critical Signals" value={String(alerts.filter((alert) => alert.severity === "critical").length)} detail="GoldRush alert count" icon={ShieldAlert} tone="rose" />
          <AlertStat label="Venues" value={String(new Set(alerts.map((alert) => alert.venue)).size)} detail="Observed venues" icon={RadioTower} tone="emerald" />
        </section>

        <section className="mt-4 pb-10">
          <LiveAlertFeed alerts={alerts} animated />
        </section>

        <section className="mt-4 pb-10">
          <AgentPanel detections={agents.detections} status={agents.status} />
        </section>
      </div>
    </main>
  );
}

function AlertStat({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof RadioTower;
  tone?: "cyan" | "rose" | "emerald";
}) {
  const toneClass = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
    rose: "border-rose-300/20 bg-rose-300/10 text-rose-200",
    emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  }[tone];

  return (
    <Card className="stat-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="numeric mt-2 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <div className={`grid size-11 place-items-center rounded-md border ${toneClass}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
