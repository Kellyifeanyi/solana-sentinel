"use client";

import { useWallet } from "@solana/wallet-adapter-react";

export function useWalletState() {
  const wallet = useWallet();

  return {
    address: wallet.publicKey?.toBase58() ?? null,
    connected: wallet.connected,
    connecting: wallet.connecting,
    disconnecting: wallet.disconnecting,
    walletName: wallet.wallet?.adapter.name ?? null,
    wallets: wallet.wallets,
    select: wallet.select,
    connect: wallet.connect,
    disconnect: wallet.disconnect,
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
  };
}
