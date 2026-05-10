import { paymentRequiredResponse, x402Config } from "@/lib/x402/client";
import { enforceX402Payment } from "@/lib/x402/middleware";

export async function GET(request: Request) {
  const config = x402Config();
  if (!config.enabled) {
    return Response.json({
      enabled: false,
      status: "disabled",
    });
  }

  const blocked = await enforceX402Payment(request);
  if (blocked) return blocked;

  return Response.json({
    enabled: true,
    status: "verified",
    asset: config.asset,
    network: config.network,
  });
}

export async function POST(request: Request) {
  const blocked = await enforceX402Payment(request);
  if (blocked) return blocked;

  return Response.json({ status: "verified" });
}

export async function OPTIONS() {
  return paymentRequiredResponse();
}
