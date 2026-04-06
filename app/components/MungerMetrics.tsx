"use client";

interface FCFConversion {
  pct: string;
  label: "Excellent" | "Good" | "Moderate" | "Weak";
}

interface MungerMetricsData {
  fcfConversion: FCFConversion | null;
  capitalIntensity: string | null;
  capitalIntensityLabel: string | null;
  earningsConsistency: string | null;
  consistencyYears: number;
  avgRoe: string | null;
  avgMargin: string | null;
}

const FCF_STYLE: Record<string, { badge: string; text: string }> = {
  Excellent: { badge: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300", text: "text-emerald-600 dark:text-emerald-400" },
  Good:      { badge: "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300",     text: "text-indigo-600 dark:text-indigo-400" },
  Moderate:  { badge: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",         text: "text-amber-600 dark:text-amber-400" },
  Weak:      { badge: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",                 text: "text-red-500" },
};

const CAPEX_STYLE: Record<string, { badge: string; text: string }> = {
  "Asset-light":   { badge: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300", text: "text-emerald-600 dark:text-emerald-400" },
  "Moderate":      { badge: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",         text: "text-amber-600 dark:text-amber-400" },
  "Capital-heavy": { badge: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",                 text: "text-red-500" },
};

const CONSISTENCY_STYLE: Record<string, { badge: string; text: string }> = {
  High:     { badge: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300", text: "text-emerald-600 dark:text-emerald-400" },
  Moderate: { badge: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",         text: "text-amber-600 dark:text-amber-400" },
  Low:      { badge: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",                 text: "text-red-500" },
};

export default function MungerMetrics({ data }: { data: MungerMetricsData }) {
  const { fcfConversion, capitalIntensity, capitalIntensityLabel, earningsConsistency, consistencyYears, avgRoe, avgMargin } = data;
  const hasAny = fcfConversion || capitalIntensity || earningsConsistency;
  if (!hasAny) return null;

  const fcfStyle    = FCF_STYLE[fcfConversion?.label ?? ""]    ?? FCF_STYLE.Weak;
  const capexStyle  = CAPEX_STYLE[capitalIntensityLabel ?? ""] ?? CAPEX_STYLE.Moderate;
  const conStyle    = CONSISTENCY_STYLE[earningsConsistency ?? ""] ?? CONSISTENCY_STYLE.Moderate;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

      {/* ── FCF Conversion ── */}
      {fcfConversion && (
        <div className="bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              FCF Conversion
            </p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${fcfStyle.badge}`}>
              {fcfConversion.label}
            </span>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${fcfStyle.text}`}>
            {fcfConversion.pct}%
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
            {Number(fcfConversion.pct) >= 100
              ? "FCF exceeds reported earnings — high quality, cash-generative business."
              : Number(fcfConversion.pct) >= 80
              ? "Most earnings convert to cash — limited accounting inflation."
              : Number(fcfConversion.pct) >= 60
              ? "Moderate gap between earnings and cash — worth investigating further."
              : "Earnings significantly exceed free cash flow — watch for accounting aggression."}
          </p>
          <p className="text-[10px] text-zinc-300 dark:text-zinc-600">FCF/sh ÷ EPS (ttm) · Source: Finviz</p>
        </div>
      )}

      {/* ── Capital Intensity ── */}
      {capitalIntensity && capitalIntensityLabel && (
        <div className="bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Capital Intensity
            </p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${capexStyle.badge}`}>
              {capitalIntensityLabel}
            </span>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${capexStyle.text}`}>
            {capitalIntensity}%
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
            {capitalIntensityLabel === "Asset-light"
              ? "Minimal reinvestment needed to grow — Munger's ideal. Cash flows freely to owners."
              : capitalIntensityLabel === "Moderate"
              ? "Reasonable reinvestment requirement. Common in industrials and consumer businesses."
              : "High CapEx relative to revenue — growth requires significant ongoing reinvestment."}
          </p>
          <p className="text-[10px] text-zinc-300 dark:text-zinc-600">|CapEx| ÷ Revenue (annual) · Source: Yahoo Finance</p>
        </div>
      )}

      {/* ── Earnings Consistency ── */}
      {earningsConsistency && (
        <div className="bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
              Earnings Consistency
            </p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${conStyle.badge}`}>
              {earningsConsistency}
            </span>
          </div>
          <p className={`text-3xl font-bold ${conStyle.text}`}>
            {earningsConsistency}
          </p>
          <div className="flex flex-col gap-1 text-xs">
            {avgRoe && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Avg ROE ({consistencyYears}Y)</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">{avgRoe}%</span>
              </div>
            )}
            {avgMargin && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Avg Net Margin ({consistencyYears}Y)</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">{avgMargin}%</span>
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
            {earningsConsistency === "High"
              ? "Stable ROE and margins over multiple years — hallmark of a durable competitive advantage."
              : earningsConsistency === "Moderate"
              ? "Some variance in profitability. May reflect cyclicality or a business in transition."
              : "Wide swings in earnings — cyclical, turnaround, or structurally challenged business."}
          </p>
          <p className="text-[10px] text-zinc-300 dark:text-zinc-600">Coefficient of variation of ROE + margin · {consistencyYears}Y · Source: Yahoo Finance</p>
        </div>
      )}

    </div>
  );
}
