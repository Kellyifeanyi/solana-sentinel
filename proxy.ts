import { NextResponse, type NextRequest } from "next/server";
import { enforceX402Payment } from "@/lib/x402/middleware";

export async function proxy(request: NextRequest) {
  const blocked = await enforceX402Payment(request);
  return blocked ?? NextResponse.next();
}

export const config = {
  matcher: ["/api/premium/:path*", "/api/x402/:path*"],
};
