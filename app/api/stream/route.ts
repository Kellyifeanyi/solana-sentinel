import { getLiveAlertFeed } from "@/lib/goldrush";

export async function GET() {
  const encoder = new TextEncoder();
  const { alerts } = await getLiveAlertFeed();

  const stream = new ReadableStream({
    async start(controller) {
      for (const alert of alerts) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(alert)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
