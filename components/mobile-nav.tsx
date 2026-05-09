"use client";

import Link from "next/link";
import { Menu, Radar, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/alerts", label: "Live Alerts" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <Button variant="secondary" className="size-11 px-0" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md" role="dialog" aria-modal="true">
          <div className="ml-auto flex h-full w-[min(86vw,360px)] flex-col border-l border-white/10 bg-slate-950/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-cyan-300 text-slate-950">
                  <Radar className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Sentinel</p>
                  <p className="text-xs text-slate-500">Mobile command</p>
                </div>
              </div>
              <Button variant="ghost" className="size-11 px-0" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="size-5" />
              </Button>
            </div>
            <div className="mt-8 grid gap-2">
              <ConnectWalletButton />
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-white/10 bg-white/[.04] px-4 py-3 text-base font-medium text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/[.08]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
