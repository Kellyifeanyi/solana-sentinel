"use client";

import { useSyncExternalStore } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WalletTransaction } from "@/types/sentinel";
import { formatUsd } from "@/lib/utils";

export function ActivityChart({ transactions }: { transactions: WalletTransaction[] }) {
  const mounted = useClientMounted();
  const data = transactions
    .slice()
    .reverse()
    .map((tx) => ({
      time: new Date(tx.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      volume: tx.amountUsd,
    }));

  if (!mounted) {
    return <div className="mt-5 h-56 min-h-56 min-w-0 rounded-lg border border-white/5 bg-white/[.03]" />;
  }

  if (!data.length) {
    return (
      <div className="mt-5 grid h-56 min-h-56 min-w-0 place-items-center rounded-lg border border-dashed border-white/10 bg-white/[.03] text-sm text-slate-500">
        Awaiting GoldRush transaction data
      </div>
    );
  }

  return (
    <div className="mt-5 h-56 min-h-56 min-w-0 rounded-lg border border-white/5 bg-slate-950/35 p-2">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.58} />
              <stop offset="95%" stopColor="#67e8f9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => formatUsd(Number(value))}
            contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff" }}
          />
          <Area type="monotone" dataKey="volume" stroke="#67e8f9" strokeWidth={2.4} fill="url(#volume)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}
