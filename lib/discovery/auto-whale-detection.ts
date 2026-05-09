import type { ActivityScanResult } from "@/types/sentinel";
import { scanActivityForDetections, type DiscoverySnapshot, type RecentActivityCandidate } from "@/lib/discovery/activity-scanner";

type ActivityLoader = () => Promise<{ candidates: RecentActivityCandidate[]; reason?: string }>;
type SnapshotLoader = (address: string) => Promise<DiscoverySnapshot | null>;

export async function detectAutoWhales({
  loadRecentActivity,
  loadSnapshot,
}: {
  loadRecentActivity: ActivityLoader;
  loadSnapshot: SnapshotLoader;
}): Promise<ActivityScanResult> {
  const activity = await loadRecentActivity();

  if (!activity.candidates.length) {
    return {
      detections: [],
      source: "empty",
      reason: activity.reason ?? "goldrush_recent_activity_unavailable",
    };
  }

  return scanActivityForDetections({
    candidates: activity.candidates,
    loadSnapshot,
  });
}
