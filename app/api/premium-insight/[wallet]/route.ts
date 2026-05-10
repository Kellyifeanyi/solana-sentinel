export async function GET(_request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  const decoded = decodeURIComponent(wallet);

  return Response.json({
    wallet: decoded,
    error: "payment_required",
    message: "402 Payment Required.",
    accepts: [{ scheme: "x402", asset: "USDC", amount: "0.05", network: "solana-mainnet" }],
  }, { status: 402, headers: { "X-402-Accepts": "USDC:0.05:solana-mainnet" } });
}
