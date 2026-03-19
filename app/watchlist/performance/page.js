"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const PerformanceChart = dynamic(() => import("@/app/components/PerformanceChart"), { ssr: false });

const PERIODS = [
  { key: "Perf Week",    label: "1W"  },
  { key: "Perf Month",   label: "1M"  },
  { key: "Perf Quarter", label: "3M"  },
  { key: "Perf Half Y",  label: "6M"  },
  { key: "Perf Year",    label: "1Y"  },
  { key: "Perf YTD",     label: "YTD" },
];

function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

function fmtMoney(n) {
  if (!n) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function PerfCell({ value, spy, showDelta = false }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  }

  const delta = spy !== null && spy !== undefined ? value - spy : null;
  const beats = delta !== null ? delta > 0 : value > 0;

  const bg = value > 2
    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
    : value > 0
    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
    : value > -2
    ? "bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400"
    : "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400";

  return (
    <div className={`rounded-md px-2 py-1.5 text-center ${bg}`}>
      <div className="text-xs font-bold tabular-nums">{fmt(value)}</div>
      {showDelta && delta !== null && (
        <div className={`text-xs tabular-nums mt-0.5 ${beats ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {fmt(delta)}
        </div>
      )}
    </div>
  );
}

function SpyRow({ spy }) {
  return (
    <tr className="border-t-2 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
      <td className="px-4 py-3 sticky left-0 bg-amber-50/80 dark:bg-amber-950/30 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-bold text-sm text-amber-700 dark:text-amber-400">SPY</span>
          <span className="text-xs text-zinc-400">Benchmark</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-xs text-zinc-400" />
      <td className="px-4 py-3 text-right text-xs text-zinc-400" />
      <td className="px-4 py-3 text-right text-xs text-zinc-400" />
      <td className="px-3 py-3" />
      {PERIODS.map(({ key }) => (
        <td key={key} className="px-3 py-3">
          <PerfCell value={spy?.[key] ?? null} spy={null} showDelta={false} />
        </td>
      ))}
    </tr>
  );
}

export default function BreakdownPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelta, setShowDelta] = useState(true);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows = data?.breakdown ?? [];
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = sortKey === "weight" ? (a.weight ?? -Infinity) : (a.perf?.[sortKey] ?? -Infinity);
        const bv = sortKey === "weight" ? (b.weight ?? -Infinity) : (b.perf?.[sortKey] ?? -Infinity);
        return sortDir === "desc" ? bv - av : av - bv;
      })
    : rows;

  function SortTh({ label, sortK, className = "" }) {
    const active = sortKey === sortK;
    return (
      <th
        onClick={() => toggleSort(sortK)}
        className={`px-3 py-3 text-center text-xs font-semibold text-zinc-500 cursor-pointer select-none whitespace-nowrap hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors ${active ? "text-indigo-600 dark:text-indigo-400" : ""} ${className}`}
      >
        {label} {active ? (sortDir === "desc" ? "↓" : "↑") : ""}
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/watchlist"
            className="text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4 inline-block transition-colors"
          >
            ← Back to Watchlist
          </Link>
          <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-2">
            My Portfolio
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Performance Breakdown</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Individual stock returns vs SPY across time periods
          </p>
          {data?.fetchedAt && (
            <p className="text-xs text-zinc-400 mt-1">
              Cached · {new Date(data.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · refreshes every 6 hrs
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* Portfolio vs SPY chart */}
        {!loading && data?.portfolio && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
            <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-4">
              Portfolio vs SPY
            </p>
            <PerformanceChart portfolio={data.portfolio} spy={data.spy} />
          </div>
        )}

        {/* Controls */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{rows.length} positions</p>
            <button
              onClick={() => setShowDelta((d) => !d)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                showDelta
                  ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                  : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showDelta ? "bg-indigo-500" : "bg-zinc-400"}`} />
              Show vs SPY delta
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black p-12 text-center">
            <p className="text-sm text-zinc-400 animate-pulse">Loading breakdown…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black p-12 text-center">
            <p className="text-zinc-400 text-sm">No stocks in your watchlist.</p>
            <Link href="/screener" className="mt-4 inline-block text-sm text-indigo-500 hover:text-indigo-600 transition-colors">
              Browse the screener →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 whitespace-nowrap">
                      Ticker
                    </th>
                    <SortTh label="Weight" sortK="weight" className="text-right" />
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 whitespace-nowrap">Value</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 whitespace-nowrap">Qty</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-zinc-500 whitespace-nowrap">Since Purchase</th>
                    {PERIODS.map((p) => (
                      <SortTh key={p.key} label={p.label} sortK={p.key} />
                    ))}
                  </tr>
                  {showDelta && (
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                      <td colSpan={5} className="px-4 py-1.5 text-xs text-zinc-400 sticky left-0 bg-zinc-50/80 dark:bg-zinc-900/50">
                        Cell: return · <span className="text-xs">sub-row: vs SPY</span>
                      </td>
                      {PERIODS.map((p) => (
                        <td key={p.key} className="px-3 py-1.5 text-center text-xs text-zinc-300 dark:text-zinc-600">
                          {data?.spy?.[p.key] !== null && data?.spy?.[p.key] !== undefined
                            ? `SPY ${fmt(data.spy[p.key])}`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {sorted.map((row, i) => (
                    <tr
                      key={row.ticker}
                      className={`border-b border-zinc-50 dark:border-zinc-900 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors ${
                        i % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-900/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-white dark:bg-black z-10">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          <Link
                            href={`/stocks/${row.ticker}?back=${encodeURIComponent("/watchlist/performance")}`}
                            className="font-bold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {row.ticker}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-zinc-600 dark:text-zinc-400 tabular-nums">
                        {row.weight !== null ? `${row.weight.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-zinc-500 tabular-nums">
                        {row.value > 0 ? fmtMoney(row.value) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-zinc-400 tabular-nums">
                        {row.quantity || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.unitReturn != null ? (
                          <PerfCell value={row.unitReturn} spy={null} showDelta={false} />
                        ) : (
                          <span className="block text-center text-zinc-300 dark:text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      {PERIODS.map(({ key }) => (
                        <td key={key} className="px-3 py-2">
                          <PerfCell
                            value={row.perf?.[key] ?? null}
                            spy={data?.spy?.[key] ?? null}
                            showDelta={showDelta}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <SpyRow spy={data?.spy} />
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-950/60" /> Strong positive (&gt;+2%)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-950/30" /> Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 dark:bg-red-950/30" /> Negative</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-950/60" /> Strong negative (&lt;-2%)</span>
            {showDelta && <span className="text-zinc-300 dark:text-zinc-600">· Sub-row shows delta vs SPY</span>}
          </div>
        )}
      </div>
    </div>
  );
}
