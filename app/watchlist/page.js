"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const PerformanceChart = dynamic(() => import("@/app/components/PerformanceChart"), { ssr: false });
const DiversificationScore = dynamic(() => import("@/app/components/DiversificationScore"), { ssr: false });
const ValuationChart = dynamic(() => import("@/app/components/ValuationChart"), { ssr: false });

function fmt(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function EditableCell({ value, onSave, placeholder, step = "1", width = "w-20" }) {
  const [val, setVal] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (val === (value != null ? String(value) : "")) return;
    setSaving(true);
    await onSave(val);
    setSaving(false);
  }

  return (
    <input
      type="number"
      min="0"
      step={step}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      disabled={saving}
      placeholder={placeholder}
      className={`${width} px-2 py-1 text-sm text-right rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50`}
    />
  );
}

function QuantityCell({ item, onUpdate }) {
  return (
    <EditableCell
      value={item.quantity || null}
      placeholder="0"
      onSave={async (val) => {
        const qty = parseInt(val) || 0;
        await fetch("/api/watchlist", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: item.ticker, quantity: qty }),
        });
        onUpdate(item.ticker, "quantity", qty);
      }}
    />
  );
}

function UnitCostCell({ item, onUpdate }) {
  return (
    <EditableCell
      value={item.unit_cost != null ? item.unit_cost : null}
      placeholder="0.00"
      step="0.01"
      width="w-24"
      onSave={async (val) => {
        const cost = parseFloat(val) || null;
        await fetch("/api/watchlist", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: item.ticker, unit_cost: cost }),
        });
        onUpdate(item.ticker, "unit_cost", cost);
      }}
    />
  );
}

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perf, setPerf] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/watchlist");
    const data = await res.json();
    setItems(data);
    setLoading(false);
    if (data.length > 0) {
      setPerfLoading(true);
      fetch("/api/performance")
        .then((r) => r.json())
        .then(setPerf)
        .finally(() => setPerfLoading(false));

      setValuationLoading(true);
      fetch("/api/watchlist/valuation")
        .then((r) => r.json())
        .then(setValuation)
        .finally(() => setValuationLoading(false));
    }
  }

  function handleFieldUpdate(ticker, field, value) {
    setItems((prev) =>
      prev.map((i) => (i.ticker === ticker ? { ...i, [field]: value } : i))
    );
  }

  async function remove(ticker) {
    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    setItems((prev) => prev.filter((i) => i.ticker !== ticker));
  }

  useEffect(() => { load(); }, []);

  const totalValue = items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const qty = parseInt(item.quantity) || 0;
    return sum + price * qty;
  }, 0);

  const totalCostBasis = items.reduce((sum, item) => {
    const cost = parseFloat(item.unit_cost) || 0;
    const qty = parseInt(item.quantity) || 0;
    return sum + cost * qty;
  }, 0);

  const hasUnitCosts = items.some((i) => i.unit_cost != null && i.unit_cost > 0);
  const unrealizedGL = hasUnitCosts && totalCostBasis > 0 ? totalValue - totalCostBasis : null;
  const unrealizedGLPct =
    unrealizedGL !== null && totalCostBasis > 0
      ? (unrealizedGL / totalCostBasis) * 100
      : null;

  const totalShares = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-2">
            My Portfolio
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Watchlist</h1>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {items.length} {items.length === 1 ? "stock" : "stocks"} tracked
            </p>
            {items.length > 0 && (
              <Link
                href="/watchlist/performance"
                className="text-sm font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
              >
                View breakdown →
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">

        {/* Summary cards */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-1">
                Total Market Value
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {totalValue > 0 ? `$${fmt(totalValue)}` : "—"}
              </p>
              <p className="text-xs text-zinc-400 mt-1">Based on price at time of adding</p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-1">
                Total Cost Basis
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {totalCostBasis > 0 ? `$${fmt(totalCostBasis)}` : "—"}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                {hasUnitCosts ? "Sum of unit cost × shares" : "Enter unit costs below"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-1">
                Unrealized G/L
              </p>
              {unrealizedGL !== null ? (
                <>
                  <p className={`text-2xl font-bold ${unrealizedGL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {unrealizedGL >= 0 ? "+" : ""}${fmt(Math.abs(unrealizedGL))}
                  </p>
                  <p className={`text-xs mt-1 font-medium ${unrealizedGL >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {unrealizedGLPct >= 0 ? "+" : ""}{unrealizedGLPct.toFixed(2)}% vs cost basis
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">—</p>
                  <p className="text-xs text-zinc-400 mt-1">Enter unit costs to calculate</p>
                </>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-1">
                Total Shares
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {totalShares > 0 ? totalShares.toLocaleString() : "—"}
              </p>
              <p className="text-xs text-zinc-400 mt-1">Across {items.length} positions</p>
            </div>
          </div>
        )}

        {/* Diversification Score */}
        {!loading && items.length > 0 && <DiversificationScore items={items} />}

        {/* Portfolio Valuation */}
        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">
                Portfolio Valuation
              </p>
              {valuation?.fetchedAt && (
                <span className="text-xs text-zinc-400">
                  Cached · {new Date(valuation.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            {valuationLoading && !valuation ? (
              <p className="text-sm text-zinc-400 animate-pulse py-8 text-center">Calculating intrinsic values…</p>
            ) : valuation?.items?.length > 0 ? (
              <ValuationChart
                items={valuation.items}
                tenYear={valuation.tenYear}
                avgMarginOfSafety={valuation.avgMarginOfSafety}
              />
            ) : (
              <p className="text-sm text-zinc-400 py-4 text-center">No valuation data available.</p>
            )}
          </div>
        )}

        {/* Performance vs SPY */}
        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">
                Portfolio vs SPY
              </p>
              {perf?.fetchedAt && (
                <span className="text-xs text-zinc-400">
                  Cached · {new Date(perf.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              {perfLoading && !perf
                ? "Fetching performance data…"
                : items.some((i) => i.quantity > 0)
                ? "Value-weighted by position size · Data cached 6 hrs"
                : "Equal-weighted · Set quantities to enable value-weighting · Data cached 6 hrs"}
            </p>

            {perfLoading && !perf ? (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-zinc-400 animate-pulse">Loading chart…</p>
              </div>
            ) : (
              <PerformanceChart portfolio={perf?.portfolio ?? null} spy={perf?.spy ?? null} />
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-sm text-zinc-400 animate-pulse">Loading...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black p-12 text-center">
            <p className="text-zinc-400 text-sm">Your watchlist is empty.</p>
            <Link
              href="/screener"
              className="mt-4 inline-block text-sm text-indigo-500 hover:text-indigo-600 transition-colors"
            >
              Browse the screener →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-6 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">Ticker</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Unit Cost</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Quantity</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Cost Basis</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Market Value</th>
                  <th className="px-6 py-3 text-left font-semibold text-zinc-500">Date Added</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const price = parseFloat(item.price) || 0;
                  const qty = parseInt(item.quantity) || 0;
                  const cost = parseFloat(item.unit_cost) || 0;
                  const value = price * qty;
                  const costBasis = cost * qty;
                  return (
                    <tr
                      key={item.ticker}
                      className="border-b border-zinc-50 dark:border-zinc-900 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/stocks/${item.ticker}?back=${encodeURIComponent("/watchlist")}`}
                          className="font-bold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {item.ticker}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <UnitCostCell item={item} onUpdate={handleFieldUpdate} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <QuantityCell item={item} onUpdate={handleFieldUpdate} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-500 tabular-nums text-sm">
                        {costBasis > 0 ? `$${fmt(costBasis)}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
                        {value > 0 ? `$${fmt(value)}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-zinc-400 text-xs">
                        {new Date(item.added_at + " UTC").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => remove(item.ticker)}
                          className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totalValue > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Total
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-semibold text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {totalCostBasis > 0 ? `$${fmt(totalCostBasis)}` : "—"}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                      ${fmt(totalValue)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
