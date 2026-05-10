import { encodeSse, getRealtimeAlerts } from "@/lib/streaming/realtime";

const STREAM_INTERVAL_MS = 15_000;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sent = new Set<string>();
      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      try {
        while (!request.signal.aborted) {
          const feed = await getRealtimeAlerts();
          const updatedAt = new Date().toISOString();
          controller.enqueue(encoder.encode(encodeSse({
            type: "status",
            status: feed.alerts.length ? "live" : "idle",
            updatedAt,
            reason: feed.reason,
          })));

          for (const alert of feed.alerts) {
            const id = `${alert.id}:${alert.wallet}:${alert.timestamp}:${alert.kind}`;
            if (sent.has(id)) continue;
            sent.add(id);
            controller.enqueue(encoder.encode(`id: ${id}\n${encodeSse({
              type: "alert",
              alert,
              updatedAt,
            })}`));
          }

          await sleep(STREAM_INTERVAL_MS, request.signal);
        }
      } catch {
        controller.enqueue(encoder.encode(encodeSse({
          type: "status",
          status: "idle",
          updatedAt: new Date().toISOString(),
          reason: "stream_unavailable",
        })));
      } finally {
        try {
          controller.close();
        } catch {
          // The browser may already have closed the SSE connection.
        }
      }
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
