"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function EditablePrice({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value != null ? String(value) : "");
  const [saving, setSaving]   = useState(false);

  async function save() {
    const parsed = parseFloat(val);
    if (!parsed || parsed <= 0 || parsed === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(parsed);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); }}
        disabled={saving}
        className="w-20 px-1.5 py-0.5 text-xs text-right rounded border border-indigo-400 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="tabular-nums text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-2 transition-colors"
      title="Click to edit sale price"
    >
      {value != null ? `$${Number(value).toFixed(2)}` : "—"}
    </button>
  );
}

// ─── Tax brackets (2024 US) ────────────────────────────────────────────────
const SHORT_TERM_BRACKETS = [
  { label: "10%",  rate: 0.10, maxIncome: 11600   },
  { label: "12%",  rate: 0.12, maxIncome: 47150   },
  { label: "22%",  rate: 0.22, maxIncome: 100525  },
  { label: "24%",  rate: 0.24, maxIncome: 191950  },
  { label: "32%",  rate: 0.32, maxIncome: 243725  },
  { label: "35%",  rate: 0.35, maxIncome: 609350  },
  { label: "37%",  rate: 0.37, maxIncome: Infinity },
];

const LONG_TERM_BRACKETS = [
  { label: "0%",   rate: 0.00, maxIncome: 47025   },
  { label: "15%",  rate: 0.15, maxIncome: 518900  },
  { label: "20%",  rate: 0.20, maxIncome: Infinity },
];

// 3.8% NIIT applies to investment income above $200k (single) / $250k (married)
const NIIT_THRESHOLD = 200000;
const NIIT_RATE      = 0.038;

function fmt(n, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-$" : "$") + str;
}

function Badge({ children, color = "zinc" }) {
  const colors = {
    zinc:    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
    emerald: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    red:     "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    amber:   "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    indigo:  "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    violet:  "bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${colors[color] ?? colors.zinc}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
        {subtitle && <p className="text-[11px] text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Unrealized P&L + term from watchlist positions ────────────────────────
function computeUnrealized(items, livePrices) {
  return items
    .filter((item) => item.quantity > 0 && item.unit_cost != null && item.unit_cost > 0)
    .map((item) => {
      const price      = livePrices[item.ticker]?.price ?? parseFloat(item.price) ?? 0;
      const unitCost   = parseFloat(item.unit_cost);
      const qty        = parseInt(item.quantity);
      const gainLoss   = (price - unitCost) * qty;
      const gainPct    = ((price - unitCost) / unitCost) * 100;
      const addedMs    = item.added_at ? new Date(item.added_at + " UTC").getTime() : null;
      const holdingDays = addedMs ? Math.floor((Date.now() - addedMs) / 86400000) : null;
      const term       = holdingDays != null ? (holdingDays >= 365 ? "long" : "short") : null;
      return { ticker: item.ticker, price, unitCost, qty, gainLoss, gainPct, holdingDays, term, proceeds: price * qty, costBasis: unitCost * qty };
    });
}

// ─── Tax liability ──────────────────────────────────────────────────────────
function computeTax(gainLoss, term, stRate, ltRate, totalIncome) {
  if (gainLoss <= 0) return 0;
  const baseRate = term === "long" ? ltRate : stRate;
  const niit     = (term === "long" || term === "short") && totalIncome > NIIT_THRESHOLD ? NIIT_RATE : 0;
  return gainLoss * (baseRate + niit);
}

// ─── Tax loss harvesting engine ─────────────────────────────────────────────
function buildHarvestingPlan(unrealized, realizedST, realizedLT, stRate, ltRate, totalIncome) {
  const losers  = unrealized.filter((p) => p.gainLoss < 0).sort((a, b) => a.gainLoss - b.gainLoss);
  const plan    = [];

  let remainST = Math.max(0, realizedST);
  let remainLT = Math.max(0, realizedLT);

  for (const pos of losers) {
    const loss = Math.abs(pos.gainLoss);
    let taxSaved = 0;
    let offsetsST = 0;
    let offsetsLT = 0;
    let description = "";

    // Losses offset ST gains first (higher tax cost), then LT gains
    if (remainST > 0) {
      const applyToST = Math.min(loss, remainST);
      const niit = totalIncome > NIIT_THRESHOLD ? NIIT_RATE : 0;
      taxSaved  += applyToST * (stRate + niit);
      offsetsST  = applyToST;
      remainST  -= applyToST;
    }
    const remaining = loss - offsetsST;
    if (remaining > 0 && remainLT > 0) {
      const applyToLT = Math.min(remaining, remainLT);
      const niit = totalIncome > NIIT_THRESHOLD ? NIIT_RATE : 0;
      taxSaved  += applyToLT * (ltRate + niit);
      offsetsLT  = applyToLT;
      remainLT  -= applyToLT;
    }

    if (taxSaved <= 0) continue; // no realized gains to offset

    if (offsetsST > 0 && offsetsLT > 0) {
      description = `Offsets ${fmtCurrency(offsetsST)} of short-term gains + ${fmtCurrency(offsetsLT)} of long-term gains`;
    } else if (offsetsST > 0) {
      description = `Offsets ${fmtCurrency(offsetsST)} of short-term gains (taxed at ${(stRate * 100).toFixed(0)}%)`;
    } else {
      description = `Offsets ${fmtCurrency(offsetsLT)} of long-term gains (taxed at ${(ltRate * 100).toFixed(0)}%)`;
    }

    plan.push({ ...pos, loss, offsetsST, offsetsLT, taxSaved, description });
  }

  return plan;
}

export default function TradesPage() {
  const [trades, setTrades]         = useState([]);
  const [watchlist, setWatchlist]   = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading]       = useState(true);

  // Tax settings
  const [stBracket, setStBracket]   = useState(2); // index into SHORT_TERM_BRACKETS (22%)
  const [ltBracket, setLtBracket]   = useState(1); // index into LONG_TERM_BRACKETS (15%)
  const [totalIncome, setTotalIncome] = useState(150000);

  const [acting, setActing]         = useState(null); // id of trade being acted on

  useEffect(() => {
    async function load() {
      const [tradesRes, watchRes] = await Promise.all([
        fetch("/api/trades").then((r) => r.json()),
        fetch("/api/watchlist").then((r) => r.json()),
      ]);
      setTrades(Array.isArray(tradesRes) ? tradesRes : []);
      const wl = Array.isArray(watchRes) ? watchRes : [];
      setWatchlist(wl);

      if (wl.length > 0) {
        fetch("/api/watchlist/prices")
          .then((r) => r.json())
          .then((prices) => {
            const map = {};
            for (const p of prices) map[p.ticker] = p;
            setLivePrices(map);
          })
          .catch(() => {});
      }
      setLoading(false);
    }
    load();
  }, []);

  async function updatePrice(id, price) {
    const res = await fetch("/api/trades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, price }),
    });
    const updated = await res.json();
    setTrades((prev) => prev.map((t) => t.id === id ? { ...t, price: updated.price, proceeds: updated.proceeds, gain_loss: updated.gain_loss } : t));
  }

  async function confirmTrade(id) {
    setActing(id);
    await fetch("/api/trades", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "confirmed" }),
    });
    setTrades((prev) => prev.map((t) => t.id === id ? { ...t, status: "confirmed" } : t));
    setActing(null);
  }

  async function reverseTrade(id) {
    setActing(id);
    await fetch("/api/trades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restore: true }),
    });
    setTrades((prev) => prev.filter((t) => t.id !== id));
    setActing(null);
  }

  async function deleteTrade(id) {
    setActing(id);
    await fetch("/api/trades", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, restore: false }),
    });
    setTrades((prev) => prev.filter((t) => t.id !== id));
    setActing(null);
  }

  const stRate  = SHORT_TERM_BRACKETS[stBracket].rate;
  const ltRate  = LONG_TERM_BRACKETS[ltBracket].rate;

  // ── Realized summary — confirmed trades only (pending excluded from tax calc) ──
  const confirmedTrades = trades.filter((t) => t.status === "confirmed");
  const pendingTrades   = trades.filter((t) => t.status === "pending");
  const realizedST      = confirmedTrades.filter((t) => t.term === "short" && t.gain_loss != null).reduce((s, t) => s + t.gain_loss, 0);
  const realizedLT      = confirmedTrades.filter((t) => t.term === "long"  && t.gain_loss != null).reduce((s, t) => s + t.gain_loss, 0);
  const realizedUnknown = confirmedTrades.filter((t) => t.term == null    && t.gain_loss != null).reduce((s, t) => s + t.gain_loss, 0);
  const totalRealized   = realizedST + realizedLT + realizedUnknown;

  const taxOwedST  = computeTax(realizedST,  "short", stRate, ltRate, totalIncome);
  const taxOwedLT  = computeTax(realizedLT,  "long",  stRate, ltRate, totalIncome);
  const totalTaxOwed = taxOwedST + taxOwedLT;

  // ── Unrealized summary ──
  const unrealized     = computeUnrealized(watchlist, livePrices);
  const unrealizedGainST  = unrealized.filter((p) => p.gainLoss > 0 && p.term === "short").reduce((s, p) => s + p.gainLoss, 0);
  const unrealizedGainLT  = unrealized.filter((p) => p.gainLoss > 0 && p.term === "long" ).reduce((s, p) => s + p.gainLoss, 0);
  const unrealizedLossST  = unrealized.filter((p) => p.gainLoss < 0 && p.term === "short").reduce((s, p) => s + p.gainLoss, 0);
  const unrealizedLossLT  = unrealized.filter((p) => p.gainLoss < 0 && p.term === "long" ).reduce((s, p) => s + p.gainLoss, 0);

  const potentialTaxST = computeTax(unrealizedGainST, "short", stRate, ltRate, totalIncome);
  const potentialTaxLT = computeTax(unrealizedGainLT, "long",  stRate, ltRate, totalIncome);

  // ── Harvesting plan ──
  const harvestingPlan = buildHarvestingPlan(unrealized, realizedST, realizedLT, stRate, ltRate, totalIncome);
  const totalHarvestSavings = harvestingPlan.reduce((s, p) => s + p.taxSaved, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <p className="text-sm text-zinc-400 animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 px-6 py-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax & Trades</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Realized P&amp;L · Unrealized exposure · Tax loss harvesting</p>
        </div>
        <Link href="/watchlist" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← Watchlist</Link>
      </div>

      {/* Tax Settings Bar */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-5 py-4 mb-8 flex flex-wrap items-center gap-6">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tax Settings (2024)</p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 whitespace-nowrap">Short-term bracket</label>
          <select
            value={stBracket}
            onChange={(e) => setStBracket(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {SHORT_TERM_BRACKETS.map((b, i) => (
              <option key={i} value={i}>{b.label} ordinary income</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 whitespace-nowrap">Long-term rate</label>
          <select
            value={ltBracket}
            onChange={(e) => setLtBracket(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {LONG_TERM_BRACKETS.map((b, i) => (
              <option key={i} value={i}>{b.label} long-term CGT</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 whitespace-nowrap">Est. total income</label>
          <input
            type="number"
            value={totalIncome}
            onChange={(e) => setTotalIncome(Number(e.target.value) || 0)}
            className="w-28 text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="150000"
          />
        </div>
        {totalIncome > NIIT_THRESHOLD && (
          <Badge color="amber">+3.8% NIIT applies</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Realized P&L */}
        <SectionCard title="Realized P&L" subtitle="Confirmed sales only — pending excluded">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Short-term gains</span>
              <span className={`text-sm font-semibold tabular-nums ${realizedST >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtCurrency(realizedST)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Long-term gains</span>
              <span className={`text-sm font-semibold tabular-nums ${realizedLT >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtCurrency(realizedLT)}</span>
            </div>
            {realizedUnknown !== 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Unknown term</span>
                <span className="text-sm font-semibold tabular-nums text-zinc-400">{fmtCurrency(realizedUnknown)}</span>
              </div>
            )}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 flex justify-between items-center">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Total realized</span>
              <span className={`text-sm font-bold tabular-nums ${totalRealized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtCurrency(totalRealized)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Tax Owed */}
        <SectionCard title="Estimated Tax Owed" subtitle="On realized gains at your brackets">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-500">Short-term tax</p>
                <p className="text-[10px] text-zinc-400">{(stRate * 100).toFixed(0)}% rate{totalIncome > NIIT_THRESHOLD ? " + 3.8% NIIT" : ""}</p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${taxOwedST > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtCurrency(taxOwedST)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-zinc-500">Long-term tax</p>
                <p className="text-[10px] text-zinc-400">{(ltRate * 100).toFixed(0)}% rate{totalIncome > NIIT_THRESHOLD ? " + 3.8% NIIT" : ""}</p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${taxOwedLT > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtCurrency(taxOwedLT)}</span>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 flex justify-between items-center">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Total tax owed</span>
              <span className={`text-sm font-bold tabular-nums ${totalTaxOwed > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>{fmtCurrency(totalTaxOwed)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Unrealized Exposure */}
        <SectionCard title="Unrealized Exposure" subtitle="Paper gains/losses in current positions">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">ST gains (if sold now)</span>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${unrealizedGainST >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtCurrency(unrealizedGainST)}</p>
                <p className="text-[10px] text-zinc-400">~{fmtCurrency(potentialTaxST)} tax</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">LT gains (if sold now)</span>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${unrealizedGainLT >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{fmtCurrency(unrealizedGainLT)}</p>
                <p className="text-[10px] text-zinc-400">~{fmtCurrency(potentialTaxLT)} tax</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Harvestable losses</span>
              <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{fmtCurrency(unrealizedLossST + unrealizedLossLT)}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Tax Loss Harvesting */}
      <div className="mb-8">
        <SectionCard
          title="Tax Loss Harvesting"
          subtitle="Sell these positions to offset realized gains — ordered by tax savings impact"
        >
          {harvestingPlan.length === 0 ? (
            <div className="py-6 text-center">
              {unrealized.filter((p) => p.gainLoss < 0).length === 0 ? (
                <p className="text-sm text-zinc-400">No positions with unrealized losses — nothing to harvest.</p>
              ) : (
                <p className="text-sm text-zinc-400">No realized gains to offset right now. Losses can still be harvested and carried forward (up to $3,000/year against ordinary income).</p>
              )}
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Potential tax savings: {fmtCurrency(totalHarvestSavings)}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-500">
                    Harvest {harvestingPlan.length} position{harvestingPlan.length !== 1 ? "s" : ""} to offset {fmtCurrency(Math.min(realizedST, harvestingPlan.reduce((s, p) => s + p.offsetsST, 0)))} ST + {fmtCurrency(Math.min(realizedLT, harvestingPlan.reduce((s, p) => s + p.offsetsLT, 0)))} LT in realized gains
                  </p>
                </div>
              </div>

              {/* Wash sale warning */}
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-amber-500 mt-0.5">⚠</span>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>Wash-sale rule:</strong> Do not repurchase the same or "substantially identical" security within 30 days before or after the sale — the IRS will disallow the loss. Consider replacing with a similar (not identical) ETF or sector fund during the 30-day window.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="pb-2 text-left font-semibold text-zinc-500 uppercase tracking-wider">Ticker</th>
                      <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Term</th>
                      <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Holding</th>
                      <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Unrealized Loss</th>
                      <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Loss%</th>
                      <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Tax Saved</th>
                      <th className="pb-2 text-left font-semibold text-zinc-500 uppercase tracking-wider pl-4">Offset Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {harvestingPlan.map((pos) => (
                      <tr key={pos.ticker} className="border-b border-zinc-100 dark:border-zinc-800/60">
                        <td className="py-2.5">
                          <Link href={`/stocks/${pos.ticker}`} className="font-semibold text-zinc-800 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400">{pos.ticker}</Link>
                          <p className="text-zinc-400">{pos.qty} shares @ {fmtCurrency(pos.unitCost)}</p>
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge color={pos.term === "long" ? "emerald" : "amber"}>
                            {pos.term === "long" ? "Long-term" : "Short-term"}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">
                          {pos.holdingDays != null ? `${pos.holdingDays}d` : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-red-500">
                          {fmtCurrency(pos.gainLoss)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-red-400">
                          {pos.gainPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                          {fmtCurrency(pos.taxSaved)}
                        </td>
                        <td className="py-2.5 pl-4 text-zinc-500 max-w-xs">{pos.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Carryforward note */}
              {(unrealizedLossST + unrealizedLossLT) < (realizedST + realizedLT) * -1 && (
                <p className="mt-3 text-[11px] text-zinc-400">
                  Remaining losses after offsetting all realized gains can be deducted up to <strong>$3,000/year</strong> against ordinary income, with the rest carried forward indefinitely.
                </p>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {/* Unrealized Positions Detail */}
      {unrealized.length > 0 && (
        <div className="mb-8">
          <SectionCard title="Unrealized Positions" subtitle="All open positions with cost basis — live prices">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-2 text-left font-semibold text-zinc-500 uppercase tracking-wider">Ticker</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Shares</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Cost</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Price</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Gain/Loss</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">%</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Term</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Holding</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">If Sold Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {unrealized.sort((a, b) => b.gainLoss - a.gainLoss).map((pos) => {
                    const tax = computeTax(pos.gainLoss, pos.term, stRate, ltRate, totalIncome);
                    return (
                      <tr key={pos.ticker} className="border-b border-zinc-100 dark:border-zinc-800/60">
                        <td className="py-2.5">
                          <Link href={`/stocks/${pos.ticker}`} className="font-semibold text-zinc-800 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400">{pos.ticker}</Link>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{pos.qty}</td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{fmtCurrency(pos.unitCost)}</td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{fmtCurrency(pos.price)}</td>
                        <td className={`py-2.5 text-right tabular-nums font-semibold ${pos.gainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {fmtCurrency(pos.gainLoss)}
                        </td>
                        <td className={`py-2.5 text-right tabular-nums ${pos.gainPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {pos.gainPct >= 0 ? "+" : ""}{pos.gainPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-right">
                          {pos.term ? (
                            <Badge color={pos.term === "long" ? "emerald" : "amber"}>
                              {pos.term === "long" ? "LT" : "ST"}
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">
                          {pos.holdingDays != null ? `${pos.holdingDays}d` : "—"}
                          {pos.term === "short" && pos.holdingDays != null && pos.holdingDays < 365 && (
                            <p className="text-[10px] text-amber-500">{365 - pos.holdingDays}d to LT</p>
                          )}
                        </td>
                        <td className={`py-2.5 text-right tabular-nums text-[11px] ${tax > 0 ? "text-red-400" : "text-zinc-400"}`}>
                          {tax > 0 ? fmtCurrency(tax) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Trade Audit Log */}
      <SectionCard
        title="Trade Audit Log"
        subtitle="Pending = limit not yet confirmed. Confirm once filled, or Reverse to restore shares."
      >
        {trades.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">No trades recorded yet. Use "Record (Pending)" in the Monthly Review to log a trade.</p>
        ) : (
          <>
            {/* Pending banner */}
            {pendingTrades.length > 0 && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-amber-500 mt-0.5 shrink-0">⏳</span>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>{pendingTrades.length} pending trade{pendingTrades.length !== 1 ? "s" : ""}</strong> — not counted in tax totals until confirmed.
                  Update the sale price if your limit filled at a different price, then hit <strong>Confirm</strong>.
                  Hit <strong>Reverse</strong> to cancel and restore your share count.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-2 text-left font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="pb-2 text-left font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                    <th className="pb-2 text-left font-semibold text-zinc-500 uppercase tracking-wider">Ticker</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Units</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Sale Price <span className="normal-case font-normal text-zinc-400">(editable)</span></th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Cost Basis</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Proceeds</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Gain/Loss</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Held</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Term</th>
                    <th className="pb-2 text-right font-semibold text-zinc-500 uppercase tracking-wider">Est. Tax</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => {
                    const isPending = t.status === "pending";
                    const tax  = !isPending && t.gain_loss != null ? computeTax(t.gain_loss, t.term, stRate, ltRate, totalIncome) : null;
                    const date = new Date(t.recorded_at + " UTC").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    const busy = acting === t.id;
                    return (
                      <tr key={t.id} className={`border-b border-zinc-100 dark:border-zinc-800/60 ${isPending ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                        <td className="py-2.5">
                          {isPending
                            ? <Badge color="amber">Pending</Badge>
                            : <Badge color="emerald">Confirmed</Badge>}
                        </td>
                        <td className="py-2.5 text-zinc-400 whitespace-nowrap">{date}</td>
                        <td className="py-2.5">
                          <Link href={`/stocks/${t.ticker}`} className="font-semibold text-zinc-800 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400">{t.ticker}</Link>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{t.units}</td>
                        <td className="py-2.5 text-right"><EditablePrice value={t.price} onSave={(price) => updatePrice(t.id, price)} /></td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">{t.unit_cost != null ? fmtCurrency(t.unit_cost) : "—"}</td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{fmtCurrency(t.proceeds)}</td>
                        <td className={`py-2.5 text-right tabular-nums font-semibold ${isPending ? "text-zinc-400 italic" : t.gain_loss == null ? "text-zinc-400" : t.gain_loss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          {t.gain_loss != null ? fmtCurrency(t.gain_loss) : "—"}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-zinc-500">
                          {t.holding_days != null ? `${t.holding_days}d` : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          {t.term ? (
                            <Badge color={t.term === "long" ? "emerald" : "amber"}>
                              {t.term === "long" ? "Long" : "Short"}
                            </Badge>
                          ) : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className={`py-2.5 text-right tabular-nums text-[11px] ${isPending ? "text-zinc-300 dark:text-zinc-600 italic" : tax != null && tax > 0 ? "text-red-400" : "text-zinc-400"}`}>
                          {isPending ? "pending" : tax != null && tax > 0 ? fmtCurrency(tax) : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPending && (
                              <button
                                onClick={() => confirmTrade(t.id)}
                                disabled={busy}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40"
                                title="Confirm — sale executed"
                              >
                                {busy ? "…" : "Confirm"}
                              </button>
                            )}
                            <button
                              onClick={() => reverseTrade(t.id)}
                              disabled={busy}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40"
                              title="Reverse — restore shares to watchlist"
                            >
                              {busy ? "…" : "Reverse"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row — confirmed only */}
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 dark:border-zinc-700">
                    <td colSpan={6} className="pt-3 text-xs font-semibold text-zinc-500">Confirmed totals</td>
                    <td className="pt-3 text-right tabular-nums text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      {fmtCurrency(confirmedTrades.reduce((s, t) => s + t.proceeds, 0))}
                    </td>
                    <td className={`pt-3 text-right tabular-nums text-xs font-bold ${totalRealized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                      {fmtCurrency(totalRealized)}
                    </td>
                    <td colSpan={2} />
                    <td className="pt-3 text-right tabular-nums text-xs font-bold text-red-400">
                      {totalTaxOwed > 0 ? fmtCurrency(totalTaxOwed) : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <p className="mt-6 text-[11px] text-zinc-300 dark:text-zinc-600">
        Tax estimates are approximations for planning only and do not constitute tax advice. Consult a CPA or tax professional for your actual tax liability. Holding periods use the position's "added to watchlist" date as a proxy for purchase date.
      </p>
    </div>
  );
}
