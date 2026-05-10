"use client";

import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useWalletState } from "@/hooks/use-wallet-state";
import { compactAddress, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { WalletReport } from "@/types/sentinel";

type BalanceSummary = {
  address: string;
  sol: number | null;
  totalUsd: number;
  tokens: Array<{
    symbol: string;
    amount: number;
    valueUsd: number;
  }>;
};

export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<WalletName | null>(null);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(null);
  const { address, connected, connecting, disconnect, wallets, select, connect, walletName } = useWalletState();
  const displayedBalance = connected && address && balanceSummary?.address === address ? balanceSummary : null;

  useEffect(() => {
    if (!pendingWallet || walletName !== pendingWallet || connected) return;
    void connect().finally(() => setPendingWallet(null));
  }, [connect, connected, pendingWallet, walletName]);

  useEffect(() => {
    if (!connected || !address) {
      return;
    }

    let cancelled = false;
    const currentAddress = address;

    async function loadConnectedBalances() {
      try {
        const response = await fetch(`/api/wallet/${encodeURIComponent(currentAddress)}`, { cache: "no-store" });
        if (!response.ok) return;
        const report = (await response.json()) as WalletReport;
        if (cancelled) return;
        const sol = report.balances.find((balance) => balance.symbol.toUpperCase() === "SOL")?.amount ?? null;
        const totalUsd = report.balances.reduce((sum, balance) => sum + balance.valueUsd, 0);
        const tokens = report.balances.slice(0, 6).map((balance) => ({
          symbol: balance.symbol,
          amount: balance.amount,
          valueUsd: balance.valueUsd,
        }));
        setBalanceSummary({ address: currentAddress, sol, totalUsd, tokens });
      } catch {
        if (!cancelled) setBalanceSummary(null);
      }
    }

    void loadConnectedBalances();
    return () => {
      cancelled = true;
    };
  }, [address, connected]);

  function chooseWallet(name: WalletName) {
    select(name);
    setPendingWallet(name);
    setOpen(false);
  }

  if (connected && address) {
    return (
      <div className="relative">
        <Button variant="secondary" onClick={() => setOpen((value) => !value)} className={compact ? "h-10 px-3" : undefined}>
          <Wallet className="size-4" />
          <span className="min-w-0 truncate">{compact ? compactAddress(address, 4) : `${walletName ?? "Wallet"} ${compactAddress(address, 4)}`}</span>
          {displayedBalance && (
            <span className="numeric hidden rounded-sm bg-white/[.06] px-1.5 py-0.5 text-xs text-slate-300 sm:inline">
              {displayedBalance.sol !== null ? `${displayedBalance.sol.toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL` : formatUsd(displayedBalance.totalUsd)}
            </span>
          )}
          <ChevronDown className="size-4" />
        </Button>
        {open && (
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/40">
            {displayedBalance && (
              <div className="mb-2 rounded-md border border-white/10 bg-white/[.035] px-3 py-2 text-xs text-slate-300">
                <p className="numeric text-white">{displayedBalance.sol !== null ? `${displayedBalance.sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL` : "SOL unavailable"}</p>
                <p className="mt-1 text-slate-500">{formatUsd(displayedBalance.totalUsd)} tracked value</p>
                {displayedBalance.tokens.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    {displayedBalance.tokens.map((token) => (
                      <div key={`${displayedBalance.address}-${token.symbol}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-slate-400">{token.symbol}</span>
                        <span className="numeric text-right text-slate-200">
                          {token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setBalanceSummary(null);
                void disconnect();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[.07]"
            >
              <LogOut className="size-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((value) => !value)} disabled={connecting} className={compact ? "h-10 px-3" : undefined}>
        <Wallet className="size-4" />
        {connecting ? "Connecting" : "Connect Wallet"}
        <ChevronDown className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/40">
          {wallets.map((wallet) => (
            <button
              key={wallet.adapter.name}
              type="button"
              onClick={() => chooseWallet(wallet.adapter.name)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/[.07]"
            >
              <span>{wallet.adapter.name}</span>
              <span className="text-xs text-slate-500">{wallet.readyState}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
