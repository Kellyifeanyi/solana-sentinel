export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type X402PaymentHeader = {
  scheme?: "x402";
  network?: "solana-mainnet";
  asset?: "USDC";
  signature?: string;
  amount?: string;
  destination?: string;
};

export function x402Enabled() {
  return process.env.X402_ENABLED?.toLowerCase() === "true";
}

export function x402Config() {
  return {
    enabled: x402Enabled(),
    wallet: process.env.X402_USDC_WALLET?.trim() ?? "",
    amountMicros: Number(process.env.X402_USDC_AMOUNT_MICROS ?? "1000000"),
    rpcUrl: process.env.X402_SOLANA_RPC_URL?.trim(),
    asset: "USDC" as const,
    network: "solana-mainnet" as const,
    mint: SOLANA_USDC_MINT,
  };
}

export function paymentRequiredResponse() {
  const config = x402Config();
  return Response.json({
    error: "payment_required",
    message: "402 Payment Required.",
    accepts: [{
      scheme: "x402",
      asset: config.asset,
      amount: String(config.amountMicros),
      unit: "micro-USDC",
      network: config.network,
      destination: config.wallet,
    }],
  }, {
    status: 402,
    headers: {
      "X-402-Accepts": `${config.asset}:${config.amountMicros}:micro:${config.network}`,
    },
  });
}

export function parseX402Header(header: string | null): X402PaymentHeader | null {
  if (!header) return null;

  try {
    return JSON.parse(header) as X402PaymentHeader;
  } catch {
    try {
      return JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as X402PaymentHeader;
    } catch {
      return null;
    }
  }
}
