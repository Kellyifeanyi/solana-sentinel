import type { RiskLevel } from "@/types/sentinel";

const colors: Record<RiskLevel, string> = {
  low: "#34d399",
  moderate: "#7dd3fc",
  high: "#fbbf24",
  critical: "#fb7185",
};

export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="relative mx-auto mt-4 grid size-48 place-items-center rounded-full">
      <div className="absolute inset-[-18px] rounded-full bg-cyan-300/5 blur-2xl" />
      <div
        className="absolute inset-0 rounded-full transition-all duration-700 ease-out"
        style={{
          background: `conic-gradient(${colors[level]} ${score * 3.6}deg, rgba(255,255,255,.08) 0deg)`,
        }}
      />
      <div className="absolute inset-3 rounded-full border border-white/10 bg-slate-950 shadow-inner shadow-black" />
      <div className="relative text-center">
        <div className="numeric text-6xl font-semibold text-white">{score}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{level} risk</div>
      </div>
    </div>
  );
}
