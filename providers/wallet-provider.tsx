"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(WalletAdapterNetwork.Mainnet), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet })], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
