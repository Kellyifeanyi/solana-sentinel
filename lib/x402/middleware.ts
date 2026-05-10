import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { parseX402Header, paymentRequiredResponse, SOLANA_USDC_MINT, x402Config } from "@/lib/x402/client";

const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const usedPaymentSignatures = new Set<string>();

function rawAmount(balance?: { uiTokenAmount?: { amount?: string | null } }) {
  const value = Number(balance?.uiTokenAmount?.amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function verifySolanaUsdcTransfer(signature: string, destinationOwner: string, exactMicros: number, rpcUrl?: string) {
  if (!SIGNATURE_PATTERN.test(signature)) return false;
  if (usedPaymentSignatures.has(signature)) return false;

  const connection = new Connection(rpcUrl || clusterApiUrl("mainnet-beta"), "finalized");
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction?.meta || transaction.meta.err) return false;

  const preBalances = transaction.meta.preTokenBalances ?? [];
  const postBalances = transaction.meta.postTokenBalances ?? [];
  const recipient = new PublicKey(destinationOwner).toBase58();

  return postBalances.some((post) => {
    if (post.mint !== SOLANA_USDC_MINT || post.owner !== recipient) return false;
    const before = preBalances.find((pre) => pre.accountIndex === post.accountIndex && pre.mint === post.mint);
    return rawAmount(post) - rawAmount(before) === exactMicros;
  });
}

export async function enforceX402Payment(request: Request): Promise<Response | null> {
  const config = x402Config();
  if (!config.enabled) return null;

  if (!config.wallet) {
    return Response.json({ error: "x402_misconfigured", message: "X402_USDC_WALLET is required when x402 is enabled." }, { status: 503 });
  }

  const payment = parseX402Header(request.headers.get("X-Payment") ?? request.headers.get("X-402-Payment"));
  if (!payment?.signature) return paymentRequiredResponse();

  const paidAmount = Number(payment.amount);
  const destinationMatches = payment.destination === config.wallet;
  const amountMatches = Number.isInteger(paidAmount) && paidAmount === config.amountMicros;
  if (payment.scheme !== "x402" || payment.asset !== "USDC" || payment.network !== "solana-mainnet" || !destinationMatches || !amountMatches) {
    return paymentRequiredResponse();
  }

  try {
    const verified = await verifySolanaUsdcTransfer(payment.signature, config.wallet, config.amountMicros, config.rpcUrl);
    if (verified) usedPaymentSignatures.add(payment.signature);
    return verified ? null : paymentRequiredResponse();
  } catch {
    return Response.json({ error: "payment_verification_unavailable", message: "Unable to verify Solana payment state." }, { status: 503 });
  }
}
