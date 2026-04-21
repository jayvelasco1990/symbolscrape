"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  Bull: "#10b981", // emerald
  Base: "#6366f1", // indigo
  Bear: "#ef4444", // red
  SPY:  "#f59e0b", // amber
};

const SCENARIO_LABELS: Record<string, string> = {
  Bull: "Bull",
  Base: "Base",
  Bear: "Bear",
  SPY:  "SPY",
};

function fmtDollar(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 shadow-lg text-sm min-w-[180px]">
      <p className="text-xs text-zinc-400 mb-2 font-medium">{label}</p>
      {sorted.map((entry: { name: string; value: number; color: string }) => {
        const gain = (((entry.value - 10000) / 10000) * 100);
        return (
          <div key={entry.name} className="flex items-center justify-between gap-5 py-0.5">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
              {SCENARIO_LABELS[entry.name] ?? entry.name}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-100 text-xs">
                {fmtDollar(entry.value)}
              </span>
              {label !== "Today" && (
                <span className={`text-[10px] tabular-nums font-medium ${gain >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                  {fmtPct(gain)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Position {
  ticker: string;
  eps5y: number | null;
  weight: number;
  contribution: number | null;
}

interface Props {
  portfolioCAGR: number;
  scenarios: { bull: number; base: number; bear: number; spy: number };
  positions: Position[];
  chartData: Record<string, string | number>[];
}

export default function ProjectionChart({ portfolioCAGR, scenarios, positions, chartData }: Props) {
  const [showMethodology, setShowMethodology] = useState(false);

  const last = chartData[chartData.length - 1];

  return (
    <div>
      {/* Scenario summary */}
      <div className="flex flex-wrap gap-5 mb-5">
        {(["Bull", "Base", "Bear", "SPY"] as const).map((s) => {
          const key = s.toLowerCase() as keyof typeof scenarios;
          const cagr = scenarios[key];
          const finalVal = last?.[s] as number | undefined;
          const gain = finalVal != null ? finalVal - 10000 : null;
          return (
            <div key={s} className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-sm ${s === "SPY" ? "opacity-70" : ""}`}
                style={{ backgroundColor: COLORS[s] }}
              />
              <div>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider leading-none mb-0.5">
                  {SCENARIO_LABELS[s]} · {fmtPct(cagr)} CAGR
                </p>
                <p className="text-sm font-bold tabular-nums" style={{ color: COLORS[s] }}>
                  {finalVal != null ? fmtDollar(finalVal) : "—"}
                  {gain != null && (
                    <span className="ml-1.5 text-xs font-medium" style={{ color: COLORS[s], opacity: 0.75 }}>
                      {fmtPct((gain / 10000) * 100)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.12)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={fmtDollar}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={10000} stroke="rgba(161,161,170,0.25)" strokeWidth={1} strokeDasharray="4 4" />

          <Line type="monotone" dataKey="Bull" stroke={COLORS.Bull} strokeWidth={2} dot={{ r: 3, fill: COLORS.Bull }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="Base" stroke={COLORS.Base} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.Base }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="Bear" stroke={COLORS.Bear} strokeWidth={2} dot={{ r: 3, fill: COLORS.Bear }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="SPY"  stroke={COLORS.SPY}  strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Methodology toggle */}
      <button
        onClick={() => setShowMethodology((v) => !v)}
        className="mt-5 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${showMethodology ? "rotate-90" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {showMethodology ? "Hide" : "Show"} methodology &amp; formula
      </button>

      {showMethodology && (
        <div className="mt-4 space-y-5 text-xs text-zinc-600 dark:text-zinc-400">

          {/* Formula */}
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider text-[10px]">
              Compound Growth Formula
            </p>
            <pre className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
{`V(t) = $10,000 × (1 + CAGR)^t

Where:
  t    = years (1 – 5)
  CAGR = Weighted Portfolio 1Y Annualized Return

Per-stock CAGR:
  rᵢ = (P_end / P_start)^(1/years) - 1
  using trailing 1-year daily close prices
  from Yahoo Finance (~252 trading days)

Portfolio CAGR = Σ ( wᵢ × rᵢ )
  wᵢ = cost basisᵢ / total cost basis
       (falls back to price × qty, then equal weight)

Scenarios:
  Bull  =  Base CAGR × 1.30   (30% above trailing rate)
  Base  =  Portfolio CAGR      (trailing 1Y annualized)
  Bear  =  Base CAGR × 0.50   (half the trailing rate)
  SPY   =  actual 1Y SPY CAGR  (same methodology)`}
            </pre>
          </div>

          {/* Per-ticker table */}
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider text-[10px]">
              Portfolio Blended CAGR — {fmtPct(portfolioCAGR)}
            </p>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-4 py-2 text-left font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">Ticker</th>
                    <th className="px-4 py-2 text-right font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">Weight</th>
                    <th className="px-4 py-2 text-right font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">1Y CAGR</th>
                    <th className="px-4 py-2 text-right font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.ticker} className="border-b border-zinc-100 dark:border-zinc-800/60">
                      <td className="px-4 py-2 font-bold text-zinc-800 dark:text-zinc-200">{p.ticker}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{p.weight.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.cagr1y != null ? (
                          <span className={p.cagr1y >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                            {fmtPct(p.cagr1y)}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {p.contribution != null ? (
                          <span className={p.contribution >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                            {fmtPct(p.contribution)}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-zinc-50 dark:bg-zinc-900">
                    <td className="px-4 py-2 font-bold text-zinc-700 dark:text-zinc-300">Portfolio</td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-400">100%</td>
                    <td className="px-4 py-2 text-right" />
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                      {fmtPct(portfolioCAGR)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Assumptions */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-3">
            <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1.5 text-[10px] uppercase tracking-wider">Assumptions &amp; Limitations</p>
            <ul className="space-y-1 text-amber-700/80 dark:text-amber-400/80 list-disc list-inside">
              <li>Uses trailing 1-year price return — past performance does not predict future returns.</li>
              <li>A strong or weak recent year will bias the projection up or down accordingly.</li>
              <li>Does not account for dividends, dilution, buybacks, or macro regime changes.</li>
              <li>The Bear scenario (50% of trailing rate) may understate risk in market downturns.</li>
              <li>All projections are hypothetical. Not financial advice.</li>
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}
