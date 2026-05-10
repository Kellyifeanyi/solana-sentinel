import { Activity, ArrowUpRight, DatabaseZap, Radar, ShieldCheck, Siren, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { WalletSearch } from "@/components/home/wallet-search";
import { MobileNav } from "@/components/mobile-nav";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";

const features = [
  { title: "Track high-value wallets", description: "Surface large transfers, DEX rotations, and bridge events from GoldRush data.", icon: Activity },
  { title: "Analyze wallet risk", description: "Score wallets from visible balances, concentration, transaction value, and activity frequency.", icon: ShieldCheck },
  { title: "Monitor transaction evidence", description: "Review transfers, swaps, mints, burns, and bridge movements returned by GoldRush.", icon: Siren },
];

export default function Home() {
  return (
    <main className="sentinel-shell min-h-screen">
      <section className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-7">
        <nav className="animate-rise flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-cyan-300 text-slate-950 shadow-[0_0_52px_rgba(103,232,249,.42)]">
              <Radar className="size-5" />
            </div>
            <div>
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-white">Solana Sentinel</span>
              <p className="mt-0.5 text-xs text-slate-500">Onchain intelligence terminal</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <ConnectWalletButton compact />
            <Link href="/alerts" className="group inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[.06] px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[.1] hover:text-white">
              Live Alerts
              <ArrowUpRight className="size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
          <MobileNav />
        </nav>

        <div className="grid flex-1 place-items-center py-20 text-center">
          <div className="animate-rise-delay max-w-6xl">
            <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 shadow-[0_0_50px_rgba(34,211,238,.12)] backdrop-blur-xl">
              <Sparkles className="size-4" />
              GoldRush-powered wallet intelligence for Solana operators
            </div>
            <h1 className="mx-auto max-w-5xl text-4xl font-semibold tracking-normal text-white drop-shadow-2xl sm:text-6xl lg:text-7xl">
              Institutional-grade Solana wallet risk intelligence.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Analyze wallet behavior, token exposure, portfolio concentration, and transaction velocity from measurable GoldRush evidence.
            </p>
            <WalletSearch />
            <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              <HeroStat label="Signals" value="24/7" />
              <HeroStat label="Chain" value="Solana" />
              <HeroStat label="Source" value="GoldRush" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="stat-card group p-6">
              <div className="grid size-12 place-items-center rounded-md border border-white/10 bg-white/[.06] text-cyan-200 shadow-[0_0_32px_rgba(34,211,238,.1)] transition group-hover:bg-cyan-300 group-hover:text-slate-950">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-6 text-xl font-semibold text-white">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{feature.description}</p>
            </Card>
          );
        })}
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Card className="terminal-grid overflow-hidden p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-200">
                <DatabaseZap className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.22em]">Intelligence Layer</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Risk, flow, and exposure fused into one operator view.</h2>
            </div>
            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3 md:w-[460px]">
              <span className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2">Large flow</span>
              <span className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2">Token risk</span>
              <span className="rounded-md border border-white/10 bg-slate-950/60 px-3 py-2">x402 insight</span>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card rounded-lg border border-white/10 bg-slate-950/45 px-4 py-3 text-left shadow-2xl shadow-black/20 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="numeric mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
