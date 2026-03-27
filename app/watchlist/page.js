"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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

const STATUS_STYLE = {
  intact: { dot: "bg-emerald-400", badge: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", label: "Intact", flagColor: "text-emerald-600 dark:text-emerald-400" },
  watch:  { dot: "bg-amber-400",   badge: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",     label: "Watch",  flagColor: "text-amber-600 dark:text-amber-400"   },
  broken: { dot: "bg-red-500",     badge: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",                 label: "Broken", flagColor: "text-red-500 dark:text-red-400"       },
};

function ThesisRow({ item, autoData, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.thesis || "");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  async function save() {
    setEditing(false);
    if (draft === (item.thesis || "")) return;
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: item.ticker, thesis: draft }),
    });
    onUpdate(item.ticker, "thesis", draft);
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
      <td colSpan={9} className="px-6 pb-4 pt-2">
        {/* Algorithm rationale */}
        {autoData ? (
          <div className="mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Why this status</p>
            {autoData.flags?.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {autoData.flags.map((f, i) => (
                  <li key={i} className={`text-xs flex items-start gap-2 ${f.level === "broken" ? "text-red-500 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    <span className="mt-0.5 shrink-0 font-bold">{f.level === "broken" ? "✗" : "⚠"}</span>
                    <span>{f.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">All monitored metrics are healthy — no concerns flagged.</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-300 dark:text-zinc-600 mb-3 animate-pulse">Analyzing metrics…</p>
        )}

        {/* Notes divider */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Your notes</p>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Why did you buy this? What would make you sell?"
                rows={2}
                className="w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={save} className="text-xs px-3 py-1 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">Save</button>
                <button onClick={() => { setEditing(false); setDraft(item.thesis || ""); }} className="text-xs px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors min-h-[1.25rem] leading-relaxed"
            >
              {item.thesis
                ? item.thesis
                : <span className="italic text-zinc-300 dark:text-zinc-600">Add your buy thesis or exit conditions…</span>}
            </div>
          )}
        </div>
      </td>
    </tr>
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
  const [livePrices, setLivePrices] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedThesis, setExpandedThesis] = useState(new Set());
  // ticker → { status, flags, summary }
  const [autoThesis, setAutoThesis] = useState({});

  async function load() {
    const res = await fetch("/api/watchlist");
    const data = await res.json();
    setItems(data);
    setLoading(false);
    if (data.length > 0) {
      // Fetch auto thesis assessment (6h cached)
      fetch("/api/watchlist/thesis-check")
        .then((r) => r.json())
        .then((rows) => {
          const map = {};
          for (const row of rows) map[row.ticker] = row;
          setAutoThesis(map);
        })
        .catch(() => {});

      // Fetch live prices (15-min cached)
      fetch("/api/watchlist/prices")
        .then((r) => r.json())
        .then((rows) => {
          const map = {};
          for (const row of rows) map[row.ticker] = row;
          setLivePrices(map);
        })
        .catch(() => {});

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

  function toggleThesis(ticker) {
    setExpandedThesis((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker); else next.add(ticker);
      return next;
    });
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

  // Use live price if available, fall back to price-at-add
  function currentPrice(item) {
    return livePrices[item.ticker]?.price ?? parseFloat(item.price) ?? 0;
  }

  const totalValue = items.reduce((sum, item) => {
    return sum + currentPrice(item) * (parseInt(item.quantity) || 0);
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
  const autoStatus = (ticker) => autoThesis[ticker]?.status ?? null;
  const brokenCount = items.filter((i) => autoStatus(i.ticker) === "broken").length;
  const watchCount  = items.filter((i) => autoStatus(i.ticker) === "watch").length;
  const filteredItems = statusFilter === "all" ? items : items.filter((i) => autoStatus(i.ticker) === statusFilter);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-2">
            My Portfolio
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Watchlist</h1>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {items.length} {items.length === 1 ? "stock" : "stocks"} tracked
            </p>
            {items.length > 0 && (
              <div className="flex items-center gap-4">
                <a
                  href="/watchlist/factsheet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M4 16h16M4 8h16" />
                  </svg>
                  Factsheet
                </a>
                <Link
                  href="/watchlist/performance"
                  className="text-sm font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  View breakdown →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-4">

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
              <p className="text-xs text-zinc-400 mt-1">
                {Object.keys(livePrices).length > 0 ? "Live prices · 15-min cache" : "Based on price at time of adding"}
              </p>
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

        {/* Thesis filter bar */}
        {!loading && items.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-400 mr-1">Thesis:</span>
            {["all", "intact", "watch", "broken"].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  statusFilter === f
                    ? f === "broken" ? "bg-red-500 border-red-500 text-white"
                      : f === "watch" ? "bg-amber-400 border-amber-400 text-white"
                      : f === "intact" ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-zinc-800 border-zinc-800 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {f === "all" ? `All (${items.length})` : f === "broken" ? `Broken${brokenCount > 0 ? ` (${brokenCount})` : ""}` : f === "watch" ? `Watch${watchCount > 0 ? ` (${watchCount})` : ""}` : "Intact"}
              </button>
            ))}
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
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-6 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">Ticker</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500">Thesis</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Price</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Day</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Unit Cost</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Qty</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">P&amp;L</th>
                  <th className="px-6 py-3 text-right font-semibold text-zinc-500">Mkt Value</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const live = livePrices[item.ticker];
                  const price = live?.price ?? parseFloat(item.price) ?? 0;
                  const changePct = live?.changePct ?? null;
                  const qty = parseInt(item.quantity) || 0;
                  const cost = parseFloat(item.unit_cost) || 0;
                  const value = price * qty;
                  const costBasis = cost * qty;
                  const pl = costBasis > 0 ? value - costBasis : null;
                  const plPct = pl !== null && costBasis > 0 ? (pl / costBasis) * 100 : null;
                  const auto = autoThesis[item.ticker];
                  const status = auto?.status ?? null;
                  const statusStyle = STATUS_STYLE[status] ?? null;
                  const isExpanded = expandedThesis.has(item.ticker);
                  return (
                    <Fragment key={item.ticker}>
                    <tr
                      className={`border-b border-zinc-50 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors ${status === "broken" ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/stocks/${item.ticker}?back=${encodeURIComponent("/watchlist")}`}
                          className="font-bold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {item.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleThesis(item.ticker)}
                          title={statusStyle ? `${statusStyle.label} — click to see why` : "Analyzing…"}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${statusStyle ? statusStyle.badge : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700"}`}
                        >
                          {statusStyle ? (
                            <>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                              {statusStyle.label}
                            </>
                          ) : (
                            <span className="animate-pulse">…</span>
                          )}
                          <span className="opacity-40 ml-0.5">{isExpanded ? "▲" : "▼"}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-zinc-800 dark:text-zinc-200 tabular-nums text-sm">
                        {price > 0 ? `$${fmt(price)}` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-xs">
                        {changePct !== null ? (
                          <span className={changePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                            {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
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
                      <td className="px-6 py-4 text-right tabular-nums text-sm">
                        {pl !== null ? (
                          <div className="flex flex-col items-end">
                            <span className={`font-semibold ${pl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                              {pl >= 0 ? "+" : "−"}${fmt(Math.abs(pl))}
                            </span>
                            {plPct !== null && (
                              <span className={`text-xs ${plPct >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-zinc-800 dark:text-zinc-200 tabular-nums text-sm">
                        {value > 0 ? `$${fmt(value)}` : "—"}
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
                    {isExpanded && (
                      <ThesisRow item={item} autoData={auto} onUpdate={handleFieldUpdate} />
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
              {totalValue > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <td colSpan={5} className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Total
                    </td>
                    <td className="px-6 py-3" />
                    <td className="px-6 py-3 text-right text-sm font-semibold tabular-nums">
                      {unrealizedGL !== null ? (
                        <span className={unrealizedGL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                          {unrealizedGL >= 0 ? "+" : "−"}${fmt(Math.abs(unrealizedGL))}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
                      ${fmt(totalValue)}
                    </td>
                    <td />
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
