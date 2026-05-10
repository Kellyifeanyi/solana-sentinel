import { buildPremiumInsight } from "@/lib/intelligence/premium-insight";
import { enforceX402Payment } from "@/lib/x402/middleware";

export async function GET(request: Request, { params }: { params: Promise<{ wallet: string }> }) {
  const blocked = await enforceX402Payment(request);
  if (blocked) return blocked;

  const { wallet } = await params;
  return Response.json(await buildPremiumInsight(decodeURIComponent(wallet)));
}
