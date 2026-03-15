"use client";

import { useState } from "react";

interface MoatQuality {
  score: number;
  level: "Strong" | "Moderate" | "Narrow" | "Weak";
  roe: string;
  roic: string;
  profitMargin: string;
  operMargin: string;
}

interface InsiderActivity {
  ownershipPct: string;
  transPct: string;
  trans: number;
  trend: "Buying" | "Neutral" | "Selling";
  ownershipLevel: "High" | "Moderate" | "Low";
}

interface Props {
  moat: MoatQuality;
  insider: InsiderActivity;
}

const MOAT_STYLE: Record<string, { badge: string; text: string }> = {
  Strong:   { badge: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-300" },
  Moderate: { badge: "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300",     text: "text-indigo-700 dark:text-indigo-300" },
  Narrow:   { badge: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",         text: "text-amber-700 dark:text-amber-300" },
  Weak:     { badge: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",             text: "text-zinc-500 dark:text-zinc-400" },
};

const INSIDER_STYLE: Record<string, { badge: string; icon: string; text: string }> = {
  Buying:  { badge: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300", icon: "↑", text: "text-emerald-600 dark:text-emerald-400" },
  Neutral: { badge: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",             icon: "→", text: "text-zinc-500 dark:text-zinc-400" },
  Selling: { badge: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",                 icon: "↓", text: "text-red-500" },
};

function parseNum(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

function MetricRow({
  label,
  value,
  goodThreshold,
  okThreshold,
  maxBar,
}: {
  label: string;
  value: string;
  goodThreshold: number;
  okThreshold: number;
  maxBar: number;
}) {
  const n = parseNum(value);
  const pct = value && value !== "-" ? Math.min((n / maxBar) * 100, 100) : 0;
  const isEmpty = !value || value === "-" || n === 0;

  const barColor = isEmpty
    ? "bg-zinc-200 dark:bg-zinc-700"
    : n >= goodThreshold
    ? "bg-emerald-500"
    : n >= okThreshold
    ? "bg-amber-500"
    : "bg-red-400";

  const textColor = isEmpty
    ? "text-zinc-400"
    : n >= goodThreshold
    ? "text-emerald-600 dark:text-emerald-400"
    : n >= okThreshold
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-500";

  const rating = isEmpty ? "—" : n >= goodThreshold ? "Good" : n >= okThreshold ? "Fair" : "Weak";

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-500 dark:text-zinc-400 w-28 shrink-0">{label}</span>
        <span className={`font-semibold tabular-nums ${textColor}`}>
          {isEmpty ? "—" : value.includes("%") ? value : `${value}%`}
        </span>
        <span className={`text-[10px] w-8 text-right ${textColor}`}>{rating}</span>
      </div>
      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BusinessQuality({ moat, insider }: Props) {
  const [showMoatInfo, setShowMoatInfo] = useState(false);
  const moatStyle   = MOAT_STYLE[moat.level]   ?? MOAT_STYLE.Weak;
  const insiderStyle = INSIDER_STYLE[insider.trend] ?? INSIDER_STYLE.Neutral;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      {/* ── Moat Quality ── */}
      <div className="bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
              Moat Quality
            </p>
            <p className={`text-lg font-bold ${moatStyle.text}`}>{moat.level}</p>
          </div>
          <div className="text-right">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${moatStyle.badge}`}>
              {moat.score}/6
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <MetricRow label="Return on Equity"  value={moat.roe}          goodThreshold={20} okThreshold={12} maxBar={30} />
          <MetricRow label="Return on Inv. Cap" value={moat.roic}        goodThreshold={15} okThreshold={8}  maxBar={25} />
          <MetricRow label="Profit Margin"      value={moat.profitMargin} goodThreshold={15} okThreshold={8}  maxBar={30} />
        </div>

        <button
          onClick={() => setShowMoatInfo((v) => !v)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors text-left"
        >
          {showMoatInfo ? "Hide methodology ↑" : "How this is scored ↓"}
        </button>
        {showMoatInfo && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
            ROE ≥ 20% or ROIC ≥ 15% or Profit Margin ≥ 15% each score +2 (Good). Half-thresholds score +1 (Fair).
            Maximum score is 6. Strong ≥ 5 · Moderate ≥ 3 · Narrow ≥ 1 · Weak = 0.
            Inspired by Warren Buffett&apos;s focus on return on capital as the primary indicator of a durable competitive advantage.
          </p>
        )}
      </div>

      {/* ── Insider Activity ── */}
      <div className="bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
              Insider Activity
            </p>
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-bold ${insiderStyle.text}`}>{insiderStyle.icon}</span>
              <p className={`text-lg font-bold ${insiderStyle.text}`}>{insider.trend}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${insiderStyle.badge}`}>
            Net {insider.trend}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">Insider Ownership</span>
            <span className={`font-semibold ${
              insider.ownershipLevel === "High"     ? "text-emerald-600 dark:text-emerald-400" :
              insider.ownershipLevel === "Moderate" ? "text-amber-600 dark:text-amber-400" :
              "text-zinc-400"
            }`}>
              {insider.ownershipPct || "—"}
              <span className="text-zinc-400 font-normal ml-1">({insider.ownershipLevel})</span>
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">6-Month Net Change</span>
            <span className={`font-semibold tabular-nums ${insiderStyle.text}`}>
              {insider.transPct || "—"}
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {insider.trend === "Buying"
            ? "Executives are net buyers over the past 6 months — a positive alignment signal."
            : insider.trend === "Selling"
            ? "Executives are net sellers. May reflect diversification or could signal reduced conviction."
            : "No significant net insider buying or selling. Neutral alignment signal."}
        </p>

        <p className="text-[10px] text-zinc-300 dark:text-zinc-600">Source: Finviz · 6-month window</p>
      </div>

    </div>
  );
}
