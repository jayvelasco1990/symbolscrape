"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RiskLevel } from "@/lib/riskScores";

interface MacroData {
  regime: "risk-on" | "neutral" | "risk-off";
  vix: number | null;
  rates: {
    tenYear: number | null;
    twoYear: number | null;
    fedFunds: number | null;
    yieldCurve: number | null;
    isInverted: boolean;
  };
  spreads: { ig: number | null; hy: number | null };
  spy: {
    price: string;
    sma200: number | null;
    aboveMA200: boolean;
    perfWeek: number | null;
    perfMonth: number | null;
    perfYTD: number | null;
  };
  sectors: Array<{
    symbol: string;
    name: string;
    price: string;
    perfWeek: number | null;
    perfMonth: number | null;
    perfYTD: number | null;
    sma200: number | null;
    rateRisk: { score: number; level: RiskLevel };
    climateRisk: { score: number; level: RiskLevel };
  }>;
  cached: boolean;
  fetchedAt: string;
}

const REGIME_CONFIG = {
  "risk-on": {
    label: "Risk-On",
    desc: "Low volatility, SPY above 200-day moving average. Favorable conditions for equities.",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  neutral: {
    label: "Neutral",
    desc: "Mixed signals. Proceed with selectivity — favor defensive names and strong balance sheets.",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "risk-off": {
    label: "Risk-Off",
    desc: "Elevated fear or SPY below trend. Consider reducing exposure and raising cash.",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

function fmt(n: number | null, d = 2, suffix = "") {
  return n != null ? `${n.toFixed(d)}${suffix}` : "—";
}
function signed(n: number | null, d = 2, suffix = "") {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(d)}${suffix}`;
}

function PerfCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-zinc-400">—</span>;
  const abs = Math.abs(v);
  let cls = "text-zinc-500 dark:text-zinc-400";
  if (v > 3) cls = "text-emerald-600 dark:text-emerald-400 font-semibold";
  else if (v > 0) cls = "text-emerald-600 dark:text-emerald-400";
  else if (v < -3) cls = "text-red-500 font-semibold";
  else if (v < 0) cls = "text-red-500";
  void abs;
  return <span className={cls}>{signed(v, 2, "%")}</span>;
}

const RISK_BADGE: Record<RiskLevel, string> = {
  Low:      "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
  Moderate: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300",
  High:     "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
  Severe:   "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${RISK_BADGE[level]}`}>
      {level}
    </span>
  );
}

function Sma200Cell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-zinc-400">—</span>;
  return (
    <span className={v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
      {signed(v, 1, "%")}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  valueClass = "text-zinc-900 dark:text-zinc-100",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SpreadBar({ value, max, label }: { value: number | null; max: number; label: string }) {
  const pct = value != null ? Math.min((value / max) * 100, 100) : 0;
  const color = value == null ? "bg-zinc-300" : value > max * 0.6 ? "bg-red-500" : value > max * 0.35 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {value != null ? `${value.toFixed(2)}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function MacroPage() {
  const [data, setData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/macro")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Macro Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Market regime, rates, credit spreads, and sector rotation
          </p>
        </div>
        {data && (
          <p className="text-xs text-zinc-400">
            {data.cached ? "Cached" : "Live"} · {data.fetchedAt?.split(" ")[1]?.substring(0, 5)} UTC
          </p>
        )}
      </div>

      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-20 text-zinc-400">
          Failed to load macro data. Try refreshing.
        </div>
      )}

      {data && (() => {
        const regime = REGIME_CONFIG[data.regime];
        return (
          <div className="space-y-6">

            {/* Regime card */}
            <div className={`rounded-xl border p-5 ${regime.bg} ${regime.border}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${regime.dot} animate-pulse`} />
                    <span className={`text-xs font-semibold uppercase tracking-widest ${regime.text}`}>
                      Market Regime
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${regime.text}`}>{regime.label}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
                    {regime.desc}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-400 mb-1">SPY</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    ${data.spy.price || "—"}
                  </p>
                  <p className={`text-xs font-semibold mt-0.5 ${data.spy.aboveMA200 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    MA200 {signed(data.spy.sma200, 1, "%")}
                  </p>
                </div>
              </div>

              {/* SPY quick perf */}
              <div className="flex gap-6 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                {[
                  { label: "1W", v: data.spy.perfWeek },
                  { label: "1M", v: data.spy.perfMonth },
                  { label: "YTD", v: data.spy.perfYTD },
                ].map(({ label, v }) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-400">{label}</p>
                    <p className={`text-sm font-semibold ${v == null ? "text-zinc-400" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {signed(v, 2, "%")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rates + VIX */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="VIX (Fear Index)"
                value={fmt(data.vix, 1)}
                sub={data.vix == null ? "" : data.vix < 18 ? "Low — calm market" : data.vix > 25 ? "High — fear elevated" : "Moderate"}
                valueClass={
                  data.vix == null ? "text-zinc-400" :
                  data.vix < 18 ? "text-emerald-600 dark:text-emerald-400" :
                  data.vix > 25 ? "text-red-500" : "text-amber-600 dark:text-amber-400"
                }
              />
              <StatCard
                label="10Y Treasury"
                value={fmt(data.rates.tenYear, 2, "%")}
                sub="US 10-year yield"
              />
              <StatCard
                label="2Y Treasury"
                value={fmt(data.rates.twoYear, 2, "%")}
                sub="US 2-year yield"
              />
              <StatCard
                label="Fed Funds Rate"
                value={fmt(data.rates.fedFunds, 2, "%")}
                sub="Current policy rate"
              />
            </div>

            {/* Yield Curve + Credit Spreads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Yield Curve */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                  Yield Curve (10Y − 2Y)
                </p>
                <div className="flex items-end gap-3 mb-3">
                  <p className={`text-3xl font-bold ${data.rates.isInverted ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {signed(data.rates.yieldCurve, 2, "%")}
                  </p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${data.rates.isInverted ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"}`}>
                    {data.rates.isInverted ? "Inverted" : "Normal"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {data.rates.isInverted
                    ? "An inverted curve (2Y > 10Y) has historically preceded recessions. Elevated macro caution warranted."
                    : "Normal curve — longer-term rates exceed short-term. Economy not pricing in near-term recession risk."}
                </p>
              </div>

              {/* Credit Spreads */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
                  Credit Spreads (OAS)
                </p>
                <div className="space-y-4">
                  <SpreadBar value={data.spreads.ig} max={3} label="IG Corporate (BAML)" />
                  <SpreadBar value={data.spreads.hy} max={10} label="High Yield (BAML)" />
                </div>
                <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
                  Widening spreads signal credit stress. IG &gt;2% or HY &gt;6% indicates elevated risk-off pressure.
                </p>
              </div>
            </div>

            {/* Sector Heatmap */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Sector ETF Performance
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  SPDR sector ETFs · sorted by YTD performance
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-zinc-400">Sector</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">1W</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">1M</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">YTD</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">vs MA200</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-400">◈ Rate Sensitivity</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-zinc-400">◉ Climate Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.sectors]
                      .sort((a, b) => (b.perfYTD ?? -Infinity) - (a.perfYTD ?? -Infinity))
                      .map((s) => (
                        <tr
                          key={s.symbol}
                          className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="px-5 py-3">
                            <Link
                              href={`/stocks/${s.symbol}`}
                              className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {s.symbol}
                            </Link>
                            <span className="ml-2 text-xs text-zinc-400">{s.name}</span>
                          </td>
                          <td className="text-right px-4 py-3 text-zinc-700 dark:text-zinc-300">
                            {s.price ? `$${s.price}` : "—"}
                          </td>
                          <td className="text-right px-4 py-3"><PerfCell v={s.perfWeek} /></td>
                          <td className="text-right px-4 py-3"><PerfCell v={s.perfMonth} /></td>
                          <td className="text-right px-4 py-3"><PerfCell v={s.perfYTD} /></td>
                          <td className="text-right px-4 py-3"><Sma200Cell v={s.sma200} /></td>
                          <td className="text-right px-4 py-3">{s.rateRisk ? <RiskBadge level={s.rateRisk.level} /> : <span className="text-zinc-300 dark:text-zinc-600 text-xs">—</span>}</td>
                          <td className="text-right px-5 py-3">{s.climateRisk ? <RiskBadge level={s.climateRisk.level} /> : <span className="text-zinc-300 dark:text-zinc-600 text-xs">—</span>}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interpretation guide */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
                How to Use This Data
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Regime → Posture</p>
                  <p>Risk-On: lean into growth and cyclicals. Neutral: be selective. Risk-Off: raise cash, rotate to defensives (XLU, XLP, XLV).</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">VIX Context</p>
                  <p>VIX below 18 = calm. 18–25 = cautious. Above 25 = fear spike — often a contrarian buy signal for quality names at a discount.</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Sector Rotation</p>
                  <p>Leading sectors (top YTD) show where institutional money is flowing. Laggards may offer value if fundamentals are intact.</p>
                </div>
              </div>
            </div>

          </div>
        );
      })()}
    </div>
  );
}
