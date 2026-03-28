"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
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
}

const RANGES = [
  { key: "ytd", label: "YTD" },
  { key: "1y",  label: "1Y"  },
  { key: "3y",  label: "3Y"  },
  { key: "5y",  label: "5Y"  },
];

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
    </div>
  );
}

export default function PriceChart({ ticker }: { ticker: string }) {
  const symbol = ticker.toUpperCase();
  const [range, setRange] = useState("1y");
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPoints([]);
    fetch(`/api/stocks/${ticker}/chart?range=${range}`)
      .then((r) => r.json())
      .then((d) => setPoints(d.points ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, range]);

  const last = points[points.length - 1];
  const tickerReturn = last ? last.ticker - 100 : null;
  const spyReturn    = last ? (last.spy ?? null) && last.spy! - 100 : null;
  const outperforms  = tickerReturn != null && spyReturn != null && tickerReturn > spyReturn;

  // Thin the points for display (max ~80 points to keep chart clean)
  const step = Math.max(1, Math.floor(points.length / 80));
  const display = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  const allValues = display.flatMap((p) => [p.ticker, p.spy ?? p.ticker]);
  const yMin = Math.floor(Math.min(...allValues) * 0.98);
  const yMax = Math.ceil(Math.max(...allValues) * 1.02);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
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
            <AreaChart data={display} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 bg-indigo-500 rounded" />
              <span className="text-[10px] text-zinc-400">{symbol}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-px bg-zinc-400 rounded border-dashed" style={{ borderTop: "2px dashed #71717a", height: 0 }} />
              <span className="text-[10px] text-zinc-400">SPY</span>
            </div>
            <span className="text-[10px] text-zinc-300 dark:text-zinc-600 ml-auto">Indexed to 100 at period start</span>
          </div>
        </>
      )}
    </div>
  );
}
