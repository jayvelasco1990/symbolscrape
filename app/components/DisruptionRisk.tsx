"use client";

import { useState } from "react";
import type { RiskScore, RiskLevel } from "@/lib/riskScores";

interface Props {
  sector: string;
  climate: RiskScore;
  rate: RiskScore;
}

const LEVEL_STYLE: Record<RiskLevel, { badge: string; bar: string; text: string }> = {
  Low:      { badge: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  Moderate: { badge: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",         bar: "bg-amber-500",   text: "text-amber-700 dark:text-amber-300" },
  High:     { badge: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300",     bar: "bg-orange-500",  text: "text-orange-700 dark:text-orange-300" },
  Severe:   { badge: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",                 bar: "bg-red-500",     text: "text-red-700 dark:text-red-300" },
};

function RiskCard({
  title,
  icon,
  risk,
  sector,
}: {
  title: string;
  icon: string;
  risk: RiskScore;
  sector: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = LEVEL_STYLE[risk.level];
  const pct = (risk.score / 10) * 100;

  return (
    <div className="bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{icon}</span>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              {title}
            </p>
          </div>
          <p className={`text-lg font-bold ${style.text}`}>{risk.level}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{sector}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
          {risk.score}/10
        </span>
      </div>

      <div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-300 dark:text-zinc-600 mt-1">
          <span>Low</span>
          <span>Severe</span>
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-left text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        {expanded ? "Hide analysis ↑" : "Show analysis ↓"}
      </button>
      {expanded && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {risk.rationale}
        </p>
      )}

      <p className="text-[10px] text-zinc-300 dark:text-zinc-600">
        Sector-based estimate · not financial advice
      </p>
    </div>
  );
}

export default function DisruptionRisk({ sector, climate, rate }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <RiskCard title="Climate & Weather Risk"  icon="◉" risk={climate} sector={sector} />
      <RiskCard title="Interest Rate Sensitivity" icon="◈" risk={rate}    sector={sector} />
    </div>
  );
}
