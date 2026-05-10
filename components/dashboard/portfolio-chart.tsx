"use client";

import { useSyncExternalStore } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { WalletBalance } from "@/types/sentinel";
import { formatUsd } from "@/lib/utils";

const COLORS = ["#67e8f9", "#a7f3d0", "#fcd34d", "#fda4af", "#c4b5fd", "#93c5fd"];

export function PortfolioChart({ balances }: { balances: WalletBalance[] }) {
  const mounted = useClientMounted();
  const data = balances.map((balance) => ({ name: balance.symbol, value: balance.valueUsd }));

  if (!mounted) {
    return <div className="h-64 min-h-64 min-w-0 rounded-lg border border-white/5 bg-white/[.03]" />;
  }

  if (!data.length) {
    return (
      <div className="grid h-64 min-h-64 min-w-0 place-items-center rounded-lg border border-dashed border-white/10 bg-white/[.03] text-sm text-slate-500">
        No balances available.
      </div>
    );
  }

  return (
    <div className="h-64 min-h-64 min-w-0 rounded-lg bg-[radial-gradient(circle,rgba(103,232,249,.08),transparent_62%)]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={4} stroke="rgba(2,6,23,.9)" strokeWidth={3}>
            {data.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatUsd(Number(value))}
            contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff" }}
          />
        </PieChart>
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
