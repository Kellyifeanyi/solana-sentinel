import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-md border border-white/10 bg-slate-950/55 px-4 text-sm text-white shadow-inner shadow-black/30 outline-none backdrop-blur-xl transition duration-200 placeholder:text-slate-500 focus:border-cyan-300/60 focus:bg-slate-950/80 focus:ring-4 focus:ring-cyan-300/10",
        className,
      )}
      {...props}
    />
  );
}
