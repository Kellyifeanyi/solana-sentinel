import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-cyan-300 text-slate-950 shadow-[0_0_34px_rgba(103,232,249,.3)] hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_48px_rgba(103,232,249,.42)]",
        variant === "secondary" && "border border-white/10 bg-white/[.07] text-white shadow-lg shadow-black/20 hover:-translate-y-0.5 hover:bg-white/[.12]",
        variant === "ghost" && "text-slate-300 hover:bg-white/[.07] hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
