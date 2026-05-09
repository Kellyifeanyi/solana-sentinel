import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass-highlight rounded-lg border border-white/10 bg-slate-950/70 shadow-[0_24px_90px_rgba(0,0,0,.34)] backdrop-blur-2xl",
        className,
      )}
      {...props}
    />
  );
}
