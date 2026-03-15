"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const PORTFOLIO_COLOR = "#6366f1"; // indigo
const SPY_COLOR       = "#f59e0b"; // amber

const PERIODS = [
  { key: "Perf Week",    label: "1W"  },
  { key: "Perf Month",   label: "1M"  },
  { key: "Perf Quarter", label: "3M"  },
  { key: "Perf Half Y",  label: "6M"  },
  { key: "Perf Year",    label: "1Y"  },
  { key: "Perf YTD",     label: "YTD" },
];

type PerfData = Partial<Record<string, number | null>>;

interface Props {
  portfolio: PerfData | null;
  spy: PerfData | null;
}

function fmt(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2">{label}</p>
      {payload.map((entry: { name: string; value: number; fill: string }) => (
        <div key={entry.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.fill ?? (entry.name === "SPY" ? SPY_COLOR : PORTFOLIO_COLOR) }} />
            {entry.name}
          </span>
          <span
            className={`font-bold tabular-nums ${
              entry.value > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : entry.value < 0
                ? "text-red-500 dark:text-red-400"
                : "text-zinc-500"
            }`}
          >
            {fmt(entry.value)}
          </span>
        </div>
      ))}
      {payload.length === 2 && payload[0].value != null && payload[1].value != null && (
        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-6">
          <span className="text-zinc-400 text-xs">vs SPY</span>
          <span
            className={`font-bold text-xs tabular-nums ${
              payload[0].value - payload[1].value > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {fmt(payload[0].value - payload[1].value)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PerformanceChart({ portfolio, spy }: Props) {
  if (!portfolio || !spy) return null;

  const data = PERIODS.map(({ key, label }) => ({
    period: label,
    Portfolio: portfolio[key] ?? null,
    SPY: spy[key] ?? null,
  })).filter((d) => d.Portfolio !== null || d.SPY !== null);

  if (!data.length) return null;

  // Dynamic Y-axis bounds with padding
  const allVals = data.flatMap((d) => [d.Portfolio, d.SPY]).filter((v): v is number => v !== null);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const pad = Math.max(Math.abs(max - min) * 0.2, 2);
  const yMin = Math.floor(min - pad);
  const yMax = Math.ceil(max + pad);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barGap={4} barCategoryGap="30%">
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(161,161,170,0.15)"
          vertical={false}
        />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 12, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[yMin, yMax]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => (
            <span style={{ color: "#a1a1aa" }}>{value}</span>
          )}
        />
        <ReferenceLine y={0} stroke="rgba(161,161,170,0.3)" strokeWidth={1} />
        <Bar dataKey="Portfolio" name="Portfolio" fill={PORTFOLIO_COLOR} radius={[4, 4, 0, 0]} opacity={0.9} />
        <Bar dataKey="SPY"       name="SPY"       fill={SPY_COLOR}       radius={[4, 4, 0, 0]} opacity={0.9} />
      </BarChart>
    </ResponsiveContainer>
  );
}
