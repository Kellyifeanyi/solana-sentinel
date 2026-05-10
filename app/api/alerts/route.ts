import { getRealtimeAlerts } from "@/lib/streaming/realtime";

export async function GET() {
  return Response.json(await getRealtimeAlerts());
}
