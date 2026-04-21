"use client";

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

const FUND_COLOR = "#6366f1"; // indigo
const SPY_COLOR  = "#f59e0b"; // amber

function fmtDollar(v: number | null | undefined) {
  if (v == null || isNaN(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const fund = payload.find((p: { name: string }) => p.name === "Fund");
  const spy  = payload.find((p: { name: string }) => p.name === "SPY");
  const alpha = fund?.value != null && spy?.value != null ? fund.value - spy.value : null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 shadow-lg text-sm min-w-[170px]">
      <p className="text-xs text-zinc-400 mb-2 font-medium">{fmtDate(label)}</p>
      {[fund, spy].filter(Boolean).map((entry: { name: string; value: number; color: string }) => {
        const gain = entry.value - 10000;
        return (
          <div key={entry.name} className="flex items-center justify-between gap-6 py-0.5">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="w-2.5 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-100 text-xs">
                {fmtDollar(entry.value)}
              </span>
              <span className={`text-[10px] tabular-nums font-medium ${gain >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                {gain >= 0 ? "+" : ""}{(((entry.value - 10000) / 10000) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
      {alpha !== null && (
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-6">
          <span className="text-[10px] text-zinc-400">Alpha vs SPY</span>
          <span className={`text-[10px] font-bold tabular-nums ${alpha >= 0 ? "text-emerald-500" : "text-red-400"}`}>
            {alpha >= 0 ? "+" : ""}{fmtDollar(Math.abs(alpha))}
          </span>
        </div>
      )}
    </div>
  );
}

interface Props {
  chartData: { date: string; Fund: number; SPY: number | null }[];
}

export default function GrowthChart({ chartData }: Props) {
  if (!chartData?.length) return null;

  // Thin X-axis to ~12 evenly spaced ticks
  const step = Math.max(1, Math.floor(chartData.length / 12));
  const tickSet = new Set(
    chartData
      .filter((_, i) => i % step === 0 || i === chartData.length - 1)
      .map((d) => d.date)
  );

  const last = chartData[chartData.length - 1];
  const fundVal    = typeof last?.Fund === "number" ? last.Fund : null;
  const spyVal     = typeof last?.SPY  === "number" ? last.SPY  : null;
  const fundGain   = fundVal != null ? fundVal - 10000 : null;
  const spyGain    = spyVal  != null ? spyVal  - 10000 : null;
  const alpha      = fundVal != null && spyVal != null ? fundVal - spyVal : null;

  return (
    <div>
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-6 mb-5">
        {fundVal != null && (
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: FUND_COLOR }} />
          <div>
            <p className="text-xs text-zinc-400 leading-none mb-0.5">My Fund</p>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
              {fmtDollar(fundVal)}
              {fundGain != null && (
                <span className={`ml-1.5 text-xs font-medium ${fundGain >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                  {fundGain >= 0 ? "+" : ""}{((fundGain / 10000) * 100).toFixed(1)}%
                </span>
              )}
            </p>
          </div>
        </div>
        )}

        {spyVal != null && (
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-sm opacity-80" style={{ backgroundColor: SPY_COLOR }} />
            <div>
              <p className="text-xs text-zinc-400 leading-none mb-0.5">SPY</p>
              <p className="text-sm font-bold text-zinc-500 tabular-nums">
                {fmtDollar(spyVal)}
                {spyGain !== null && (
                  <span className={`ml-1.5 text-xs font-medium ${spyGain >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                    {spyGain >= 0 ? "+" : ""}{((spyGain / 10000) * 100).toFixed(1)}%
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {alpha !== null && (
          <div className="ml-auto text-right">
            <p className="text-xs text-zinc-400 leading-none mb-0.5">Alpha</p>
            <p className={`text-sm font-bold tabular-nums ${alpha >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {alpha >= 0 ? "+" : ""}{fmtDollar(Math.abs(alpha))}
            </p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.12)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (tickSet.has(v) ? fmtDate(v) : "")}
            interval={0}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={fmtDollar}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={10000} stroke="rgba(161,161,170,0.25)" strokeWidth={1} strokeDasharray="4 4" />

          <Line
            type="monotone"
            dataKey="Fund"
            name="Fund"
            stroke={FUND_COLOR}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: FUND_COLOR }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="SPY"
            name="SPY"
            stroke={SPY_COLOR}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3, fill: SPY_COLOR }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
