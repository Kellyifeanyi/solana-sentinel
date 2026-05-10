import { getLiveAlertFeedForAddresses } from "@/lib/goldrush";
import { generateWatchlist } from "@/lib/watchlist/generate";
import type { SentinelAlert } from "@/types/sentinel";

export type RealtimePayload =
  | { type: "status"; status: "live" | "idle"; updatedAt: string; reason?: string }
  | { type: "alert"; alert: SentinelAlert; updatedAt: string };

function eventId(alert: SentinelAlert) {
  return `${alert.id}:${alert.wallet}:${alert.timestamp}:${alert.kind}`;
}

export async function getRealtimeAlerts(): Promise<{ alerts: SentinelAlert[]; source: "goldrush" | "empty"; reason?: string }> {
  const watchlist = await generateWatchlist();
  if (!watchlist.wallets.length) {
    return { alerts: [], source: "empty", reason: watchlist.reason ?? "no_watchlist" };
  }

  const wallets = watchlist.wallets.map((wallet) => wallet.address);
  const feed = await getLiveAlertFeedForAddresses(wallets);
  const unique = Array.from(new Map(feed.alerts.map((alert) => [eventId(alert), alert])).values())
    .sort((a, b) => {
      const severityRank = { critical: 4, high: 3, moderate: 2, low: 1 };
      const severityDelta = severityRank[b.severity] - severityRank[a.severity];
      if (severityDelta) return severityDelta;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, 16);

  return unique.length
    ? { alerts: unique, source: "goldrush" }
    : { alerts: [], source: "empty", reason: feed.reason ?? "insufficient evidence" };
}

export function encodeSse(payload: RealtimePayload) {
  return `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
