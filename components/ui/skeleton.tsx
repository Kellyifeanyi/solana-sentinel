import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md border border-white/5 bg-white/[.08] shadow-inner shadow-black/20", className)} />;
}
