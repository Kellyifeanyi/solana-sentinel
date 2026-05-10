import { ArrowDownLeft, ArrowUpRight, Dot, ExternalLink, Repeat2 } from "lucide-react";
import { RiskBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { compactAddress, formatRelativeTime, formatUsd } from "@/lib/utils";
import type { WalletTransaction } from "@/types/sentinel";

function directionIcon(direction: WalletTransaction["direction"]) {
  if (direction === "inbound") return ArrowDownLeft;
  if (direction === "outbound") return ArrowUpRight;
  if (direction === "self") return Repeat2;
  return Dot;
}

function directionLabel(direction: WalletTransaction["direction"]) {
  if (direction === "inbound") return "Inbound";
  if (direction === "outbound") return "Outbound";
  if (direction === "self") return "Self";
  return "Unknown";
}

function evidenceBasis(tx: WalletTransaction) {
  if (tx.risk === "critical" || tx.risk === "high") {
    return `${tx.risk} risk from GoldRush transaction notional or execution status.`;
  }

  if (tx.type === "swap") {
    return "DEX activity returned by GoldRush transaction logs.";
  }

  return `${tx.type} event returned by GoldRush.`;
}

export function DataTrack({ transactions }: { transactions: WalletTransaction[] }) {
  const rows = transactions.slice(0, 12);

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/10 bg-white/[.025] p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Data Track</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">GoldRush transaction evidence trail.</p>
      </div>

      {!rows.length ? (
        <div className="p-5 sm:p-6">
          <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No chain evidence available.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {rows.map((tx) => {
            const Icon = directionIcon(tx.direction);
            const explorerHref = `https://solscan.io/tx/${encodeURIComponent(tx.id)}`;

            return (
              <div key={tx.id} className="grid gap-3 p-4 transition hover:bg-white/[.035] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-5">
                <div className="flex items-center gap-3 sm:block">
                  <div className="grid size-9 place-items-center rounded-md border border-white/10 bg-slate-950/60 text-cyan-200">
                    <Icon className="size-4" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.14em] text-slate-500 sm:mt-2 sm:block">{directionLabel(tx.direction)}</span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold uppercase text-white">{tx.type}</span>
                    <RiskBadge level={tx.risk} />
                    <span className="numeric text-xs text-slate-500">{formatRelativeTime(tx.timestamp)}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <span className="min-w-0 break-all">Hash {compactAddress(tx.id, 8)}</span>
                    <span className="min-w-0 break-words">Asset {tx.token}</span>
                    <span className="min-w-0 break-words">Counterparty {compactAddress(tx.counterparty, 6)}</span>
                    <span className="numeric min-w-0 break-words">Value {formatUsd(tx.amountUsd)}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">{evidenceBasis(tx)}</p>
                </div>

                <a
                  href={explorerHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-slate-300 transition hover:border-cyan-300/30 hover:text-white sm:justify-self-end"
                >
                  Tx
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
