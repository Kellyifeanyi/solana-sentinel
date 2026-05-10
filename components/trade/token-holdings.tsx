"use client";

import { ArrowRightLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionDrawer } from "@/components/trade/action-drawer";
import { actionPair, detectedTokenPair, tradeToken, type TradeTokenSymbol } from "@/lib/trading/tokens";
import { formatUsd } from "@/lib/utils";
import type { SignalAction } from "@/types/signal-action";
import type { WalletBalance } from "@/types/sentinel";

function actionForBalance(balance: WalletBalance): SignalAction | null {
  const token = tradeToken(balance.symbol);
  if (!token && !balance.mintAddress) return null;

  if (!token && balance.mintAddress) {
    return {
      id: `holding-usdc-${balance.symbol.toLowerCase()}-${balance.mintAddress}`,
      title: `Buy ${balance.symbol} with USDC`,
      reason: `${balance.symbol} is present in GoldRush balances with ${formatUsd(balance.valueUsd)} tracked value.`,
      suggestedAction: `Preview a USDC to ${balance.symbol} Jupiter route.`,
      tokenPair: detectedTokenPair({
        input: "USDC",
        output: balance.symbol,
        outputMint: balance.mintAddress,
        outputDecimals: balance.decimals,
        amount: 25,
      }),
      supportingSignals: [
        `${balance.symbol} balance amount is ${balance.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}.`,
        `Detected mint ${balance.mintAddress}.`,
      ],
    };
  }

  const input = token!.symbol as TradeTokenSymbol;
  const output: TradeTokenSymbol = input === "USDC" ? "SOL" : "USDC";
  const amount = input === "SOL" ? Math.min(Math.max(balance.amount * 0.05, 0.01), 0.05) : 25;

  return {
    id: `holding-${input.toLowerCase()}-${output.toLowerCase()}`,
    title: input === "USDC" ? "Buy SOL with USDC" : `Sell ${input}`,
    reason: `${balance.symbol} is present in GoldRush balances with ${formatUsd(balance.valueUsd)} tracked value.`,
    suggestedAction: input === "USDC" ? "Preview a USDC to SOL Jupiter route." : `Preview a ${input} to ${output} Jupiter route.`,
    tokenPair: actionPair(input, output, amount),
    supportingSignals: [
      `${balance.symbol} balance amount is ${balance.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}.`,
      `${balance.symbol} visible balance value is ${formatUsd(balance.valueUsd)}.`,
    ],
  };
}

export function TokenHoldings({ balances }: { balances: WalletBalance[] }) {
  const [selected, setSelected] = useState<SignalAction | null>(null);
  const holdings = useMemo(() => balances.map((balance) => ({ balance, action: actionForBalance(balance) })), [balances]);

  if (!balances.length) {
    return <p className="rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No balances available.</p>;
  }

  return (
    <>
      <div className="space-y-3">
        {holdings.map(({ balance, action }, index) => {
          const row = (
            <div className="group flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[.035] p-3 text-left transition hover:border-cyan-300/20 hover:bg-white/[.06]">
              <div className="min-w-0">
                <p className="font-medium text-white">{balance.symbol}</p>
                <p className="truncate text-xs text-slate-500">{balance.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-right">
                <div>
                  <p className="numeric text-sm font-semibold text-white">{formatUsd(balance.valueUsd)}</p>
                  <p className={balance.change24h >= 0 ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>{balance.change24h}% 24h</p>
                </div>
                {action && <ArrowRightLeft className="size-4 text-cyan-200 opacity-80" />}
              </div>
            </div>
          );

          return action ? (
            <button key={`${balance.symbol}-${balance.name}-${index}`} type="button" onClick={() => setSelected(action)} className="block w-full">
              {row}
            </button>
          ) : (
            <div key={`${balance.symbol}-${balance.name}-${index}`}>{row}</div>
          );
        })}
      </div>
      {!holdings.some(({ action }) => action) && (
        <div className="mt-3 rounded-md border border-white/10 bg-white/[.03] p-4 text-sm text-slate-400">No chain evidence available</div>
      )}
      <ActionDrawer action={selected} quote={null} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </>
  );
}
