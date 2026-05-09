import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types/sentinel";

const levelClass: Record<RiskLevel, string> = {
  low: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  moderate: "border-sky-300/30 bg-sky-300/10 text-sky-200",
  high: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  critical: "border-rose-300/30 bg-rose-300/10 text-rose-200",
};

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium", className)} {...props} />;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge className={levelClass[level]}>{level.toUpperCase()}</Badge>;
}
