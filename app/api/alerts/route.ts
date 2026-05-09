import { getLiveAlertFeed } from "@/lib/goldrush";

export async function GET() {
  return Response.json(await getLiveAlertFeed());
}
