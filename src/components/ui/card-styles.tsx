import { motion } from "framer-motion";
import React from "react";

/* ═══════════════════════════════════════════════════════════════
   CARD STYLE 1 — VYRALITY (Animated Gradient Border) 
   Used on: Landing Page (index.tsx)
   Features: Conic gradient spinning border, dark glass, glow
   ═══════════════════════════════════════════════════════════════ */
export function VyralityCard({ children, className = "" }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`group relative rounded-[24px] p-[2px] overflow-hidden transition-all duration-500 hover:scale-[1.02] ${className}`}>
      {/* Animated conic gradient border */}
      <div
        className="absolute inset-0 rounded-[24px] opacity-60 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: "conic-gradient(from var(--gradient-angle, 0deg), transparent 0%, #e8f553 10%, #f97316 20%, #fef3c7 25%, #f97316 30%, #e8f553 40%, transparent 50%, transparent 100%)",
          animation: "border-spin 4s linear infinite",
          padding: "2px",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      {/* Inner card */}
      <div className="relative z-10 rounded-[22px] bg-[#0A0A0A] h-full p-6 border border-white/[0.03]">
        {/* Top gradient glow */}
        <div className="absolute top-0 right-0 w-full h-48 bg-gradient-to-b from-brand-500/8 to-transparent pointer-events-none rounded-[22px]" />
        <div className="relative z-10">{children}</div>
      </div>
      {/* Glow on hover */}
      <div className="absolute -inset-4 rounded-[24px] opacity-0 group-hover:opacity-100 transition-all duration-700 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle at center, rgba(232,245,83,0.06), transparent 70%)" }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARD STYLE 2 — MARKETS (Dark Row Card with Color Dots)
   Used on: Dashboard Home (dashboard/index.tsx)
   Features: Colored dot indicators, data rows, hover scale
   ═══════════════════════════════════════════════════════════════ */
export function MarketsCard({ children, className = "" }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <div
      className={`group relative rounded-2xl bg-zinc-900/70 border border-zinc-800/60 p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30 hover:border-zinc-700/80 ${className}`}
    >
      {children}
    </div>
  );
}

export function MarketsRow({ children, className = "" }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/60 transition-colors cursor-default ${className}`}>
      {children}
    </div>
  );
}

export function MarketsDot({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75`} style={{ backgroundColor: color }} />
        <span className={`relative inline-flex h-2 w-2 rounded-full`} style={{ backgroundColor: color }} />
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARD STYLE 3 — NVDA (Background Image Cover Card)
   Used on: Notifications (dashboard/notifications.tsx)
   Features: bg-cover image, emerald/green accents, status badges
   ═══════════════════════════════════════════════════════════════ */
export function NvdaCard({ children, className = "", bgImage }: {
  children: React.ReactNode; className?: string; bgImage?: string;
}) {
  return (
    <div
      className={`group relative flex flex-col p-6 rounded-2xl transition-all duration-300 hover:scale-[1.03] hover:shadow-3xl justify-between opacity-0 animate-[fadeInSlideBlur_0.8s_ease-out_forwards] ${className}`}
      style={{
        background: bgImage
          ? `linear-gradient(135deg, rgba(0,0,0,0.75), rgba(0,0,0,0.4)), url(${bgImage})`
          : "linear-gradient(135deg, #18181b, #09090b)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "rgba(0,0,0,0.25) 0px 25px 50px -12px, rgba(255,255,255,0.05) 0px 0px 0px 1px",
      }}
    >
      {children}
    </div>
  );
}

export function NvdaBadge({ children, color = "emerald" }: {
  children: React.ReactNode; color?: "emerald" | "amber" | "rose" | "purple";
}) {
  const colors = {
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`text-[11px] px-3 py-1.5 rounded-full font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARD STYLE 4 — NUTRITION (Ring Border with Progress Bars)
   Used on: Repositories (dashboard/repositories.tsx)
   Features: ring-1 stone borders, progress bars, clean data grid
   ═══════════════════════════════════════════════════════════════ */
export function NutritionCard({ children, className = "" }: {
  children: React.ReactNode; className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-5 transition-all duration-300 hover:shadow-xl ${className}`}
      style={{
        boxShadow: "0px 0px 0px 1px rgba(255,255,255,0.06), 0px 1px 1px -0.5px rgba(0,0,0,0.06), 0px 3px 3px -1.5px rgba(0,0,0,0.06), 0px 6px 6px -3px rgba(0,0,0,0.06), 0px 12px 12px -6px rgba(0,0,0,0.06), 0px 24px 24px -12px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </div>
  );
}

export function NutritionProgressBar({ value, color = "brand" }: {
  value: number; color?: "brand" | "amber" | "rose" | "cyan";
}) {
  const colors = {
    brand: "bg-brand-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    cyan: "bg-cyan-400",
  };
  const bgColors = {
    brand: "bg-brand-500/20",
    amber: "bg-amber-500/20",
    rose: "bg-rose-500/20",
    cyan: "bg-cyan-500/20",
  };
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${bgColors[color]} mb-1`}>
      <div className={`h-full rounded-full ${colors[color]} transition-all duration-700`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function NutritionMiniCard({ children, className = "", ringColor = "border-brand-500/20" }: {
  children: React.ReactNode; className?: string; ringColor?: string;
}) {
  return (
    <div className={`rounded-xl p-3 ring-1 ${ringColor} bg-white/[0.03] ${className}`}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CARD STYLE 5 — STATS (Conic Ring + Chart Bar Hybrid)
   Used on: Analytics (dashboard/analytics.tsx)
   Features: Conic gradient ring, progress bars, data-friendly
   ═══════════════════════════════════════════════════════════════ */
export function StatsCard({ children, className = "", ring = false, ringColor = "from-brand-400 via-amber-400 to-rose-400" }: {
  children: React.ReactNode; className?: string; ring?: boolean; ringColor?: string;
}) {
  return (
    <div className={`relative rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 transition-all duration-300 hover:border-white/[0.15] hover:shadow-lg hover:-translate-y-0.5 ${className}`}>
      {/* Conic gradient ring decoration */}
      {ring && (
        <div className="absolute -top-0.5 -right-0.5 w-16 h-16 opacity-20 pointer-events-none">
          <div
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(from 0deg, ${ringColor.replace("from-", "").split(" ")[0] || "#e8f553"}, ${ringColor.split(" ")[1]?.replace("via-", "") || "#f97316"}, ${ringColor.split(" ")[2]?.replace("to-", "") || "#fb7185"})`,
              maskImage: "radial-gradient(farthest-side, transparent 55%, black 56%)",
              WebkitMaskImage: "radial-gradient(farthest-side, transparent 55%, black 56%)",
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}

export function StatsMiniCard({ children, className = "", color = "brand" }: {
  children: React.ReactNode; className?: string; color?: "brand" | "amber" | "rose" | "cyan";
}) {
  const colors = {
    brand: "bg-brand-500/10 text-brand-400 ring-brand-500/20",
    amber: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 ring-rose-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20",
  };
  return (
    <div className={`rounded-xl p-3 ring-1 text-center ${colors[color]} ${className}`}>
      {children}
    </div>
  );
}

export function StatsBar({ value, maxValue = 100, color = "#e8f553" }: {
  value: number; maxValue?: number; color?: string;
}) {
  const pct = Math.min(100, Math.max(3, (value / maxValue) * 100));
  return (
    <div className="flex-1 h-full flex flex-col justify-end">
      <div
        className="w-full rounded-t-sm transition-all duration-700 hover:opacity-80"
        style={{
          height: `${pct}%`,
          background: `linear-gradient(to top, ${color}88, ${color})`,
          boxShadow: `0 0 6px ${color}44`,
        }}
      />
    </div>
  );
}
