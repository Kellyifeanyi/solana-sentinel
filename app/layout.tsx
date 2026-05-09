import type { Metadata } from "next";
import { SolanaWalletProvider } from "@/providers/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Sentinel",
  description: "Premium Solana wallet intelligence powered by GoldRush APIs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-slate-950 text-slate-100">
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
      </body>
    </html>
  );
}
