"use client";

import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useWalletState } from "@/hooks/use-wallet-state";
import { compactAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<WalletName | null>(null);
  const { address, connected, connecting, disconnect, wallets, select, connect, walletName } = useWalletState();

  useEffect(() => {
    if (!pendingWallet || walletName !== pendingWallet || connected) return;
    void connect().finally(() => setPendingWallet(null));
  }, [connect, connected, pendingWallet, walletName]);

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
          {compact ? compactAddress(address, 4) : `${walletName ?? "Wallet"} ${compactAddress(address, 4)}`}
          <ChevronDown className="size-4" />
        </Button>
        {open && (
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-black/40">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
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
