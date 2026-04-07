"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Point {
  date: string;
  ticker: number;
  spy: number | null;
  sma50: number | null;
  sma200: number | null;
}

interface ChartStats {
  vol: number | null;
  maxDrawdown: number | null;
  beta: number | null;
  sharpe: number | null;
}

const RANGES = [
  { key: "ytd", label: "YTD" },
  { key: "1y",  label: "1Y"  },
  { key: "3y",  label: "3Y"  },
  { key: "5y",  label: "5Y"  },
];

const STAT_INFO: Record<string, { label: string; description: string; positive: string }> = {
  vol: {
    label: "Volatility",
    description: "Annualized price volatility — how much the stock swings day to day.",
    positive: "Lower is steadier. Under 20% is typical for stable large caps. Above 40% signals high risk.",
  },
  maxDrawdown: {
    label: "Max Drawdown",
    description: "The largest peak-to-trough decline over the period.",
    positive: "Closer to 0% is better. Within -15% is manageable. Below -40% indicates significant risk events.",
  },
  beta: {
    label: "Beta",
    description: "How much the stock moves relative to the S&P 500.",
    positive: "Beta = 1 moves with the market. Under 1 = lower volatility. Over 1.5 = amplified swings. Negative = inverse to market.",
  },
  sharpe: {
    label: "Sharpe Ratio",
    description: "Risk-adjusted return: how much return you get per unit of risk (vs 4.5% risk-free rate).",
    positive: "Above 1.0 is strong — you're well-compensated for the risk. Above 2.0 is exceptional. Below 0.5 means poor risk/reward.",
  },
};

function formatDate(dateStr: string, range: string) {
  const d = new Date(dateStr);
  if (range === "ytd" || range === "1y") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, range, symbol }: any) {
  if (!active || !payload?.length) return null;
  const ticker = payload.find((p: any) => p.dataKey === "ticker");
  const spy    = payload.find((p: any) => p.dataKey === "spy");
  const sma50  = payload.find((p: any) => p.dataKey === "sma50");
  const sma200 = payload.find((p: any) => p.dataKey === "sma200");
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-zinc-400 mb-1">{formatDate(label, range)}</p>
      {ticker && (
        <p className="font-semibold text-indigo-600 dark:text-indigo-400">
          {symbol}: {ticker.value.toFixed(1)} ({ticker.value >= 100 ? "+" : ""}{(ticker.value - 100).toFixed(1)}%)
        </p>
      )}
      {spy?.value != null && (
        <p className="text-zinc-500 dark:text-zinc-400">
          SPY: {spy.value.toFixed(1)} ({spy.value >= 100 ? "+" : ""}{(spy.value - 100).toFixed(1)}%)
        </p>
      )}
      {sma50?.value != null && (
        <p className="text-amber-500">SMA 50: {sma50.value.toFixed(1)}</p>
      )}
      {sma200?.value != null && (
        <p className="text-rose-400">SMA 200: {sma200.value.toFixed(1)}</p>
      )}
    </div>
  );
}

function statColor(key: string, value: number): string {
  if (key === "vol") {
    if (value < 20) return "text-emerald-600 dark:text-emerald-400";
    if (value < 35) return "text-amber-500";
    return "text-red-500";
  }
  if (key === "maxDrawdown") {
    if (value > -15) return "text-emerald-600 dark:text-emerald-400";
    if (value > -30) return "text-amber-500";
    return "text-red-500";
  }
  if (key === "beta") {
    if (value >= 0.5 && value <= 1.2) return "text-emerald-600 dark:text-emerald-400";
    if (value > 1.2 && value <= 1.8) return "text-amber-500";
    return "text-red-500";
  }
  if (key === "sharpe") {
    if (value >= 1.0) return "text-emerald-600 dark:text-emerald-400";
    if (value >= 0.5) return "text-amber-500";
    return "text-red-500";
  }
  return "text-zinc-600 dark:text-zinc-400";
}

function StatCard({ statKey, value }: { statKey: string; value: number | null }) {
  const [open, setOpen] = useState(false);
  const info = STAT_INFO[statKey];
  if (!info) return null;

  const formatted = (() => {
    if (value == null) return "—";
    if (statKey === "vol")         return `${value.toFixed(1)}%`;
    if (statKey === "maxDrawdown") return `${value.toFixed(1)}%`;
    if (statKey === "beta")        return value.toFixed(2);
    if (statKey === "sharpe")      return value.toFixed(2);
    return String(value);
  })();

  const color = value != null ? statColor(statKey, value) : "text-zinc-400";

  return (
    <div className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2.5 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
      >
        <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-0.5">{info.label}</p>
        <p className={`text-sm font-semibold tabular-nums ${color}`}>{formatted}</p>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-20 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-xl text-xs">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{info.label}</p>
          <p className="text-zinc-500 dark:text-zinc-400 mb-2 leading-relaxed">{info.description}</p>
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
            <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-0.5">What's good?</p>
            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">{info.positive}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-2 right-2 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 text-sm"
          >✕</button>
        </div>
      )}
    </div>
  );
}

export default function PriceChart({ ticker }: { ticker: string }) {
  const symbol = ticker.toUpperCase();
  const [range, setRange] = useState("1y");
  const [points, setPoints] = useState<Point[]>([]);
  const [stats, setStats] = useState<ChartStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPoints([]);
    setStats(null);
    fetch(`/api/stocks/${ticker}/chart?range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        setPoints(d.points ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, range]);

  const last = points[points.length - 1];
  const tickerReturn = last ? last.ticker - 100 : null;
  const spyReturn    = last?.spy != null ? last.spy - 100 : null;
  const outperforms  = tickerReturn != null && spyReturn != null && tickerReturn > spyReturn;

  // Thin to max ~80 points for clean rendering
  const step = Math.max(1, Math.floor(points.length / 80));
  const display = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  const allValues = display.flatMap((p) =>
    [p.ticker, p.spy, p.sma50, p.sma200].filter((v): v is number => v != null)
  );
  const yMin = allValues.length ? Math.floor(Math.min(...allValues) * 0.98) : 90;
  const yMax = allValues.length ? Math.ceil(Math.max(...allValues) * 1.02) : 110;

  const hasSMA50  = display.some((p) => p.sma50  != null);
  const hasSMA200 = display.some((p) => p.sma200 != null);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            Price Performance
          </p>
          {!loading && tickerReturn != null && (
            <p className={`text-sm font-semibold mt-0.5 ${tickerReturn >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {tickerReturn >= 0 ? "+" : ""}{tickerReturn.toFixed(1)}%
              {spyReturn != null && (
                <span className="text-zinc-400 font-normal ml-2 text-xs">
                  vs SPY {spyReturn >= 0 ? "+" : ""}{spyReturn.toFixed(1)}%
                  {" "}({outperforms ? "▲ outperforming" : "▼ underperforming"})
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                range === r.key
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="h-48 flex items-center justify-center text-zinc-400 text-xs animate-pulse">
          Loading chart…
        </div>
      )}

      {!loading && display.length === 0 && (
        <div className="h-48 flex items-center justify-center text-zinc-400 text-xs">
          No price data available
        </div>
      )}

      {!loading && display.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={display} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tickerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="spyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#71717a" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v, range)}
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 10, fill: "#a1a1aa" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
                width={36}
              />
              <Tooltip content={<CustomTooltip range={range} symbol={symbol} />} />
              <Area
                type="monotone"
                dataKey="spy"
                stroke="#71717a"
                strokeWidth={1.5}
                fill="url(#spyGrad)"
                dot={false}
                strokeDasharray="4 2"
                connectNulls
                name="SPY"
              />
              <Area
                type="monotone"
                dataKey="ticker"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#tickerGrad)"
                dot={false}
                connectNulls
                name={symbol}
              />
              {hasSMA200 && (
                <Line
                  type="monotone"
                  dataKey="sma200"
                  stroke="#f87171"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="SMA 200"
                  strokeDasharray="6 3"
                />
              )}
              {hasSMA50 && (
                <Line
                  type="monotone"
                  dataKey="sma50"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="SMA 50"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-indigo-500 rounded" />
              <span className="text-[10px] text-zinc-400">{symbol}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5" style={{ borderTop: "2px dashed #71717a" }} />
              <span className="text-[10px] text-zinc-400">SPY</span>
            </div>
            {hasSMA50 && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 bg-amber-400 rounded" />
                <span className="text-[10px] text-zinc-400">SMA 50</span>
              </div>
            )}
            {hasSMA200 && (
              <div className="flex items-center gap-1.5">
                <div className="w-5" style={{ borderTop: "2px dashed #f87171" }} />
                <span className="text-[10px] text-zinc-400">SMA 200</span>
              </div>
            )}
            <span className="text-[10px] text-zinc-300 dark:text-zinc-600 ml-auto">Indexed to 100 at period start</span>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <StatCard statKey="vol"         value={stats.vol} />
              <StatCard statKey="maxDrawdown" value={stats.maxDrawdown} />
              <StatCard statKey="beta"        value={stats.beta} />
              <StatCard statKey="sharpe"      value={stats.sharpe} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
