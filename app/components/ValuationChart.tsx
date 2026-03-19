"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

interface ValuationItem {
  ticker: string;
  price: number | null;
  grahamValue: number | null;
  grahamRevised: number | null;
  marginOfSafety: number | null;
  quantity: number;
}

interface Props {
  items: ValuationItem[];
  tenYear: number | null;
  avgMarginOfSafety: number | null;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { payload: ValuationItem }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 shadow-lg text-xs min-w-[160px]">
      <p className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">{label}</p>
      <div className="flex flex-col gap-1.5">
        {d.price != null && (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Current Price</span>
            <span className="font-semibold tabular-nums">${d.price.toFixed(2)}</span>
          </div>
        )}
        {d.grahamValue != null && (
          <div className="flex justify-between gap-4">
            <span className="text-emerald-600 dark:text-emerald-400">Graham Number</span>
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              ${d.grahamValue.toFixed(2)}
            </span>
          </div>
        )}
        {d.grahamRevised != null && (
          <div className="flex justify-between gap-4">
            <span className="text-amber-600 dark:text-amber-400">Revised Graham</span>
            <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              ${d.grahamRevised.toFixed(2)}
            </span>
          </div>
        )}
        {d.marginOfSafety != null && (
          <div className={`flex justify-between gap-4 pt-1 border-t border-zinc-100 dark:border-zinc-700 ${d.marginOfSafety >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            <span>Margin of Safety</span>
            <span className="font-bold tabular-nums">
              {d.marginOfSafety >= 0 ? "+" : ""}{d.marginOfSafety.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MoSBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`text-xs font-semibold tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

export default function ValuationChart({ items, tenYear, avgMarginOfSafety }: Props) {
  const hasRevised = items.some((i) => i.grahamRevised != null);
  const undervalued = items.filter((i) => i.marginOfSafety != null && i.marginOfSafety >= 0).length;
  const overvalued  = items.filter((i) => i.marginOfSafety != null && i.marginOfSafety < 0).length;
  const noData      = items.filter((i) => i.grahamValue == null).length;

  // Height scales with number of items — each row needs ~52px
  const chartHeight = Math.max(260, items.length * 52);

  return (
    <div className="flex flex-col gap-4">

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Avg Margin of Safety</p>
          {avgMarginOfSafety != null ? (
            <p className={`text-xl font-bold ${avgMarginOfSafety >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {avgMarginOfSafety >= 0 ? "+" : ""}{avgMarginOfSafety.toFixed(1)}%
            </p>
          ) : (
            <p className="text-xl font-bold text-zinc-400">—</p>
          )}
          <p className="text-xs text-zinc-400 mt-0.5">Value-weighted</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Undervalued</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{undervalued}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Price &lt; Graham</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">Overvalued</p>
          <p className="text-xl font-bold text-red-500 dark:text-red-400">{overvalued}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Price &gt; Graham</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-0.5">10Y Yield</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {tenYear != null ? `${tenYear.toFixed(2)}%` : "—"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">Revised Graham input</p>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={items}
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barGap={2}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(113,113,122,0.15)" />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="ticker"
              width={52}
              tick={{ fontSize: 12, fontWeight: 700, fill: "currentColor" }}
              className="text-zinc-700 dark:text-zinc-300"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{value}</span>
              )}
            />

            {/* Graham Number bar */}
            <Bar dataKey="grahamValue" name="Graham Number" radius={[0, 3, 3, 0]} maxBarSize={14}>
              {items.map((entry) => (
                <Cell
                  key={entry.ticker}
                  fill={entry.grahamValue != null && entry.price != null && entry.price <= entry.grahamValue
                    ? "#10b981"
                    : "#6ee7b7"
                  }
                />
              ))}
            </Bar>

            {/* Revised Graham bar — only if data exists */}
            {hasRevised && (
              <Bar dataKey="grahamRevised" name="Revised Graham" fill="#f59e0b" fillOpacity={0.75} radius={[0, 3, 3, 0]} maxBarSize={14} />
            )}

            {/* Current Price bar */}
            <Bar dataKey="price" name="Current Price" radius={[0, 3, 3, 0]} maxBarSize={14}>
              {items.map((entry) => (
                <Cell
                  key={entry.ticker}
                  fill={
                    entry.grahamValue == null
                      ? "#a1a1aa"
                      : entry.price != null && entry.price <= entry.grahamValue
                      ? "#6366f1"
                      : "#ef4444"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-ticker margin of safety table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="py-2 text-left font-semibold text-zinc-500 pr-4">Ticker</th>
              <th className="py-2 text-right font-semibold text-zinc-500 px-3">Price</th>
              <th className="py-2 text-right font-semibold text-zinc-500 px-3">Graham</th>
              {hasRevised && <th className="py-2 text-right font-semibold text-zinc-500 px-3">Revised</th>}
              <th className="py-2 text-right font-semibold text-zinc-500 pl-3">Margin of Safety</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.ticker} className="border-b border-zinc-50 dark:border-zinc-900 last:border-0">
                <td className="py-2 font-bold text-zinc-900 dark:text-zinc-50 pr-4">{item.ticker}</td>
                <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400 px-3">
                  {item.price != null ? `$${item.price.toFixed(2)}` : "—"}
                </td>
                <td className="py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 px-3">
                  {item.grahamValue != null ? `$${item.grahamValue.toFixed(2)}` : "—"}
                </td>
                {hasRevised && (
                  <td className="py-2 text-right tabular-nums text-amber-600 dark:text-amber-400 px-3">
                    {item.grahamRevised != null ? `$${item.grahamRevised.toFixed(2)}` : "—"}
                  </td>
                )}
                <td className="py-2 text-right pl-3">
                  {item.marginOfSafety != null ? (
                    <MoSBadge value={item.marginOfSafety} />
                  ) : (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {noData > 0 && (
        <p className="text-xs text-zinc-400">
          {noData} position{noData > 1 ? "s" : ""} excluded — negative or zero EPS (Graham Number not applicable)
        </p>
      )}

      <p className="text-xs text-zinc-400">
        Graham Number: √(22.5 × EPS × Book/sh) · Revised Graham: EPS × (8.5 + 2g) × (4.4 / 10Y yield) where g = estimated EPS growth %
      </p>
    </div>
  );
}
