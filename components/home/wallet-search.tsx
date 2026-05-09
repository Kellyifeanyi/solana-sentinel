"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WalletSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [address, setAddress] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = address.trim();
    if (value) router.push(`/wallet/${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={submit} className={compact ? "flex w-full flex-col gap-2 sm:flex-row" : "mx-auto mt-10 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"}>
      <Input
        aria-label="Wallet address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="Paste a Solana wallet address"
        className={compact ? "h-11 min-w-0" : ""}
      />
      <Button type="submit" className={compact ? "h-11 w-full px-3 sm:w-auto" : "min-h-11 sm:w-44"}>
        <Search className="size-4" />
        Analyze
      </Button>
    </form>
  );
}
