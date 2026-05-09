import { getWalletReport } from "@/lib/goldrush";

export async function GET(_request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const report = await getWalletReport(decodeURIComponent(address));
  return Response.json(report);
}
