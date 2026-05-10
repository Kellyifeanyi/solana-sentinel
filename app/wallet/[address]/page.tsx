import Link from "next/link";
import { AlertTriangle, ArrowLeft, BrainCircuit, CheckCircle2, CircleDollarSign, DatabaseZap, Radar, ShieldAlert } from "lucide-react";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { DataTrack } from "@/components/dashboard/data-track";
import { LiveAlertFeed } from "@/components/dashboard/live-alert-feed";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { PremiumInsight } from "@/components/dashboard/premium-insight";
import { RiskMeter } from "@/components/dashboard/risk-meter";
import { ActionOpportunities } from "@/components/trade/action-opportunities";
import { TokenHoldings } from "@/components/trade/token-holdings";
import { RiskBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WalletSearch } from "@/components/home/wallet-search";
import { MobileNav } from "@/components/mobile-nav";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { getLiveAlerts, getWalletReport } from "@/lib/goldrush";
import { buildWalletStory } from "@/lib/insights/wallet-story";
import { deriveActionOpportunities } from "@/lib/signals/action-engine";
import { compactAddress, formatRelativeTime, formatUsd } from "@/lib/utils";

export default async function WalletPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const report = await getWalletReport(decodeURIComponent(address));
  const alerts = await getLiveAlerts();
  const totalValue = report.balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
  const highRiskCount = report.transactions.filter((tx) => tx.risk === "high" || tx.risk === "critical").length;
  const walletStory = buildWalletStory(report);
  const actions = deriveActionOpportunities(report);
  const hasEvidence = report.balances.length > 0 || report.transactions.length > 0;

  return (
    <main className="sentinel-shell min-h-screen">
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <nav className="animate-rise flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Link href="/" className="grid size-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[.06] text-slate-300 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:text-white">
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Wallet report</p>
                <h1 className="mt-1 truncate text-2xl font-semibold text-white sm:text-3xl">{compactAddress(report.address, 8)}</h1>
              </div>
              <div className="hidden sm:block"><RiskBadge level={report.level} /></div>
            </div>
            <MobileNav />
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
            <ConnectWalletButton compact />
            <div className="w-full lg:w-[430px]">
              <WalletSearch compact />
            </div>
          </div>
        </nav>

        <section className="animate-rise-delay mt-8 grid gap-4 md:grid-cols-3">
          <TerminalStat label="Portfolio Value" value={formatUsd(totalValue)} detail={`${report.balances.length} tracked assets`} icon={CircleDollarSign} />
          <TerminalStat label="Risk Events" value={String(highRiskCount)} detail="High severity transactions" icon={ShieldAlert} tone="rose" />
          <TerminalStat label="Data Source" value={report.source.toUpperCase()} detail="GoldRush normalized feed" icon={DatabaseZap} tone="emerald" />
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card className="stat-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Risk Score</p>
                <p className="mt-1 text-sm text-slate-300">GoldRush evidence score</p>
              </div>
              <span className="rounded-md border border-white/10 bg-white/[.06] px-2 py-1 text-xs text-slate-400">{report.source}</span>
            </div>
            <RiskMeter score={report.score} level={report.level} lowInformation={!hasEvidence} />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metric label="Portfolio" value={formatUsd(totalValue)} />
              <Metric label="Tokens" value={String(report.balances.length)} />
              <Metric label="Frequency" value={`${report.signals.transactionFrequencyScore}/100`} />
              <Metric label="Volatility" value={`${report.signals.volatilityExposureScore}/100`} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <CircleDollarSign className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Portfolio Overview</p>
                <p className="text-sm text-slate-400">Token exposure and concentration profile.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-[280px_1fr]">
              <PortfolioChart balances={report.balances} />
              <TokenHoldings balances={report.balances} />
            </div>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Recent Activity Timeline</p>
            <ActivityChart transactions={report.transactions} />
            <div className="mt-4 space-y-3">
              {report.transactions.length ? report.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[.03] p-3 transition hover:border-cyan-300/20 hover:bg-white/[.055]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{tx.type.toUpperCase()} {tx.token}</p>
                    <p className="truncate text-xs text-slate-500">{tx.counterparty} · {formatRelativeTime(tx.timestamp)}</p>
                  </div>
                  <div className="text-right">
                    <p className="numeric text-sm font-semibold text-white">{formatUsd(tx.amountUsd)}</p>
                    <RiskBadge level={tx.risk} />
                  </div>
                </div>
              )) : (
                <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No transactions available.</p>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md border border-amber-300/20 bg-amber-300/10 text-amber-200">
                  <AlertTriangle className="size-5" />
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Suspicious Tokens</p>
              </div>
              <div className="mt-4 space-y-3">
                {report.signals.suspiciousTokens.length ? report.signals.suspiciousTokens.map((token) => (
                  <div key={token.symbol} className="rounded-md border border-white/10 bg-white/[.03] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{token.symbol}</span>
                      <RiskBadge level={token.severity} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{token.reason}</p>
                    <p className="mt-2 text-xs text-slate-500">Exposure {formatUsd(token.exposureUsd)}</p>
                    <div className="mt-2 space-y-1">
                      {token.evidence.map((evidence) => (
                        <p key={evidence} className="text-xs leading-5 text-slate-500">{evidence}</p>
                      ))}
                    </div>
                  </div>
                )) : <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No token warnings available.</p>}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Radar className="size-5" />
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">High-Value Indicators</p>
              </div>
              <div className="mt-4 space-y-3">
                {report.signals.highValueIndicators.length ? report.signals.highValueIndicators.map((indicator) => (
                  <div key={indicator} className="flex gap-3 text-sm leading-6 text-slate-300">
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-cyan-200" />
                    <span>{indicator}</span>
                  </div>
                )) : (
                  <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No indicators available.</p>
                )}
              </div>
            </Card>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_420px]">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Recommendation Panel</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {report.recommendations.length ? report.recommendations.map((recommendation) => (
                <div key={recommendation} className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50 shadow-[0_0_34px_rgba(34,211,238,.08)]">
                  {recommendation}
                </div>
              )) : <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No recommendations available.</p>}
            </div>
          </Card>
          <PremiumInsight wallet={report.address} evidenceAvailable={hasEvidence} />
        </section>

        <section className="mt-4">
          <ActionOpportunities actions={actions} />
        </section>

        <section className="mt-4">
          <DataTrack transactions={report.transactions} />
        </section>

        <section className="mt-4">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <BrainCircuit className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Wallet Intelligence Insights</p>
                  {walletStory.summary && <p className="mt-1 text-sm leading-6 text-slate-400">{walletStory.summary}</p>}
                </div>
              </div>
              <span className="w-fit shrink-0 rounded-md border border-white/10 bg-white/[.06] px-2 py-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                {walletStory.source}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {walletStory.insights.length ? walletStory.insights.map((insight) => (
                <div key={insight.id} className="rounded-md border border-white/10 bg-white/[.035] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 text-sm font-semibold text-white">{insight.title}</p>
                    <RiskBadge level={insight.severity} />
                  </div>
                  <p className="mt-3 break-words text-sm leading-6 text-slate-300">{insight.narrative}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {insight.evidence.map((item) => (
                      <div key={`${insight.id}-${item.label}`} className="min-w-0 rounded-md border border-white/10 bg-slate-950/45 px-3 py-2">
                        <p className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                        <p className="numeric mt-1 break-words text-sm font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )) : <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No wallet insights available.</p>}
            </div>
          </Card>
        </section>

        <section className="mt-4 pb-10">
          <LiveAlertFeed alerts={alerts.slice(0, 4)} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card rounded-md border border-white/10 bg-white/[.045] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="numeric mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TerminalStat({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
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
