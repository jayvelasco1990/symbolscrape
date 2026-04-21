"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const PerformanceChart = dynamic(() => import("@/app/components/PerformanceChart"), { ssr: false });
const DiversificationScore = dynamic(() => import("@/app/components/DiversificationScore"), { ssr: false });
const ValuationChart = dynamic(() => import("@/app/components/ValuationChart"), { ssr: false });
const GrowthChart = dynamic(() => import("@/app/components/GrowthChart"), { ssr: false });
const ProjectionChart = dynamic(() => import("@/app/components/ProjectionChart"), { ssr: false });

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
      <td colSpan={11} className="px-6 pb-4 pt-2">
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

// ─── Time Horizon ─────────────────────────────────────────────────────────────

const HORIZONS = {
  short:  { label: "Short",  sub: "< 6 mo",   color: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800", spyLagThreshold: -3,  stopLossAlpha: -8  },
  medium: { label: "Medium", sub: "6–18 mo",  color: "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800", spyLagThreshold: -5,  stopLossAlpha: -12 },
  long:   { label: "Long",   sub: "2–3 yr",   color: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", spyLagThreshold: -10, stopLossAlpha: -20 },
  core:   { label: "Core",   sub: "5+ yr",    color: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800", spyLagThreshold: null, stopLossAlpha: null },
};

function HorizonSelector({ value, onSave }) {
  const hz = HORIZONS[value] ?? HORIZONS.medium;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer select-none ${hz.color}`}
      >
        {hz.label}
        <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden min-w-[130px]">
          {Object.entries(HORIZONS).map(([key, h]) => (
            <button
              key={key}
              onClick={() => { onSave(key); setOpen(false); }}
              className={`px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${value === key ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-zinc-600 dark:text-zinc-300"}`}
            >
              <span className="font-semibold">{h.label}</span>
              <span className="ml-1.5 text-zinc-400">{h.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Macro Drivers ────────────────────────────────────────────────────────────

const MACRO_DRIVERS = {
  none:        { label: "No Driver",         etf: null,   etfName: "",             inverseThesis: false, thesisDesc: "" },
  oil_falling: { label: "Oil Falling",       etf: "XOP",  etfName: "Oil E&P",      inverseThesis: true,  thesisDesc: "Thesis assumes declining oil — tailwind for airlines, transports, consumers. Rising oil prices are a thesis risk." },
  oil_rising:  { label: "Oil Rising",        etf: "XOP",  etfName: "Oil E&P",      inverseThesis: false, thesisDesc: "Thesis assumes rising oil prices — energy sector tailwind. Falling oil = thesis risk." },
  airlines:    { label: "Airlines",          etf: "JETS", etfName: "Airlines ETF", inverseThesis: false, thesisDesc: "Monitors JETS — airlines benefit from lower fuel costs and travel recovery." },
  consumer:    { label: "Consumer Recovery", etf: "XLY",  etfName: "Cons. Disc.",  inverseThesis: false, thesisDesc: "Thesis depends on consumer spending staying strong." },
  industrials: { label: "Industrials Cycle", etf: "XLI",  etfName: "Industrials",  inverseThesis: false, thesisDesc: "Thesis depends on industrial expansion and manufacturing activity." },
  tech:        { label: "Tech / AI",         etf: "QQQ",  etfName: "Nasdaq 100",   inverseThesis: false, thesisDesc: "Thesis driven by technology or AI investment cycle." },
  biotech:     { label: "Biotech / FDA",     etf: "XBI",  etfName: "Biotech",      inverseThesis: false, thesisDesc: "Driven by FDA approvals or clinical trial outcomes." },
  energy_sec:  { label: "Energy Sector",     etf: "XLE",  etfName: "Energy",       inverseThesis: false, thesisDesc: "Energy sector position tracking commodity prices and E&P activity." },
};

function buildEtfLookup(macro) {
  if (!macro) return {};
  const lookup = {};
  for (const idx of macro.indexes ?? []) lookup[idx.symbol] = idx;
  for (const sector of macro.sectors ?? []) {
    lookup[sector.symbol] = sector;
    for (const sub of sector.subsectors ?? []) lookup[sub.symbol] = sub;
  }
  return lookup;
}

function MacroDriverSelector({ value, onSave }) {
  const key = value && MACRO_DRIVERS[value] ? value : "none";
  const driver = MACRO_DRIVERS[key];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const isSet = key !== "none";
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer select-none transition-colors ${
          isSet
            ? "bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300"
            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400"
        }`}
      >
        {driver.label}
        <svg className="w-2.5 h-2.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden min-w-[160px]">
          {Object.entries(MACRO_DRIVERS).map(([k, d]) => (
            <button
              key={k}
              onClick={() => { onSave(k === "none" ? null : k); setOpen(false); }}
              className={`px-3 py-2 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${key === k ? "font-bold text-sky-600 dark:text-sky-400" : "text-zinc-600 dark:text-zinc-300"}`}
            >
              <span className="font-semibold">{d.label}</span>
              {d.etf && <span className="ml-1.5 text-zinc-400 text-[10px]">{d.etf}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Monthly Sell Plan ────────────────────────────────────────────────────────

function sellPriority(thesisStatus, mo, sinceAlpha, targetUp, targetDown, crossover, timeHorizon = "medium") {
  // Priority 1 — thesis broken
  if (thesisStatus === "broken") return { rank: 1, reason: "Thesis broken" };
  // Priority 2 — stop loss: user target takes precedence, else fall back to horizon default
  const hz = HORIZONS[timeHorizon] ?? HORIZONS.medium;
  const effectiveStop = targetDown != null ? Math.abs(targetDown) : (hz.stopLossAlpha != null ? Math.abs(hz.stopLossAlpha) : null);
  const stopHit = effectiveStop != null && sinceAlpha != null && sinceAlpha <= -effectiveStop;
  const stopLabel = targetDown != null ? "target" : `${hz.label} default`;
  if (stopHit) return { rank: 2, reason: `Stop loss hit (${sinceAlpha.toFixed(1)}% · ${stopLabel}: −${effectiveStop}%)` };
  // Priority 3 — take profit target triggered
  const profitHit = targetUp != null && sinceAlpha != null && sinceAlpha >= targetUp;
  if (profitHit) return { rank: 3, reason: `Take profit hit (+${sinceAlpha.toFixed(1)}% vs +${targetUp}% target)` };
  // Priority 4 — just crossed SPY (mean-reversion trim)
  if (crossover?.signal === "trim") return { rank: 4, reason: crossover.reason, trimPct: crossover.trimPct };
  // Priority 5 — bearish momentum + thesis on watch
  if (thesisStatus === "watch" && mo?.label === "Bearish") return { rank: 5, reason: "Bearish momentum + thesis on watch" };
  // Priority 6 — thesis on watch
  if (thesisStatus === "watch") return { rank: 6, reason: "Thesis on watch" };
  // Priority 7 — bearish momentum alone
  if (mo?.label === "Bearish") return { rank: 7, reason: "Bearish momentum" };
  // Priority 8 — weakest since-buy alpha (laggards)
  return { rank: 8, reason: sinceAlpha != null ? `Since-buy α: ${sinceAlpha.toFixed(1)}%` : "No alpha data" };
}

function MonthlySellPlan({ items, momentum, autoThesis, livePrices, spySinceInception, crossovers, onUpdate }) {
  const [monthlyTarget, setMonthlyTarget] = useState("");

  const target = parseFloat(monthlyTarget);

  const ranked = items
    .map((item) => {
      const mo         = momentum[item.ticker];
      const thesis     = autoThesis[item.ticker];
      const price      = livePrices[item.ticker]?.price ?? parseFloat(item.price) ?? 0;
      const qty        = parseInt(item.quantity) || 0;
      const cost       = parseFloat(item.unit_cost) || 0;
      const sinceReturn = cost > 0 && price > 0 ? ((price - cost) / cost) * 100 : null;
      const sinceAlpha  = sinceReturn != null && spySinceInception != null ? sinceReturn - spySinceInception : null;
      const targetUp    = item.alpha_target_up   != null ? parseFloat(item.alpha_target_up)   : null;
      const targetDown  = item.alpha_target_down != null ? parseFloat(item.alpha_target_down) : null;
      const crossover   = crossovers[item.ticker] ?? null;
      const timeHorizon = item.time_horizon ?? "medium";
      const priority    = sellPriority(thesis?.status ?? null, mo ?? null, sinceAlpha, targetUp, targetDown, crossover, timeHorizon);
      const maxCash     = price * qty;
      return { ticker: item.ticker, price, qty, sinceAlpha, priority, maxCash, crossover };
    })
    .filter((r) => r.qty > 0 && r.price > 0)
    .sort((a, b) => {
      if (a.priority.rank !== b.priority.rank) return a.priority.rank - b.priority.rank;
      // Within same rank, sort by worst sinceAlpha first
      const aα = a.sinceAlpha ?? 999;
      const bα = b.sinceAlpha ?? 999;
      return aα - bα;
    });

  // Greedy allocation: work down ranked list until monthly target is met
  // Crossover-triggered rows are capped at their trimPct (partial trim only)
  let remaining = target > 0 ? target : 0;
  const plan = ranked.map((r) => {
    if (remaining <= 0) return { ...r, sharesToSell: 0, cashGenerated: 0 };
    const cashNeeded = remaining;
    // If this is a crossover trim signal, cap at trimPct of the position
    const maxShares = r.priority.rank === 4 && r.priority.trimPct
      ? Math.max(1, Math.floor(r.qty * (r.priority.trimPct / 100)))
      : r.qty;
    const sharesToSell  = Math.min(maxShares, Math.ceil(cashNeeded / r.price));
    const cashGenerated = parseFloat((sharesToSell * r.price).toFixed(2));
    remaining = Math.max(0, remaining - cashGenerated);
    return { ...r, sharesToSell, cashGenerated };
  });

  const totalCash   = plan.reduce((s, r) => s + r.cashGenerated, 0);
  const shortfall   = target > 0 ? Math.max(0, target - totalCash) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">
          Monthly Sell Plan
        </p>
      </div>
      <p className="text-xs text-zinc-400 mb-4">
        Set a monthly cash target — positions are ranked by sell priority and trimmed in order until the target is met
      </p>

      {/* Target input */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-sm text-zinc-400">$</span>
        <input
          type="number"
          min="0"
          step="100"
          value={monthlyTarget}
          onChange={(e) => setMonthlyTarget(e.target.value)}
          placeholder="1000"
          className="w-28 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <span className="text-sm text-zinc-400">/ month target</span>
        {target > 0 && (
          <span className={`ml-2 text-xs font-semibold tabular-nums ${shortfall > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            {shortfall > 0
              ? `Can raise $${fmt(totalCash)} — $${fmt(shortfall)} short`
              : `Can raise $${fmt(totalCash)} ✓`}
          </span>
        )}
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-zinc-400">Add quantities to your positions to generate a sell plan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wider w-6">#</th>
                <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wider">Ticker</th>
                <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">Price</th>
                <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">Held</th>
                <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">Since Buy α</th>
                <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wider px-4">Sell Reason</th>
                {target > 0 && <>
                  <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">Shares to Sell</th>
                  <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">Cash</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {(target > 0 ? plan : ranked).map((row, i) => {
                const isTrimmed = target > 0 && row.sharesToSell > 0;
                return (
                  <tr
                    key={row.ticker}
                    className={`border-b border-zinc-50 dark:border-zinc-900 ${isTrimmed ? "bg-amber-50/30 dark:bg-amber-950/10" : "opacity-50"}`}
                  >
                    <td className="py-2.5 text-zinc-300 dark:text-zinc-600 text-[10px]">{i + 1}</td>
                    <td className="py-2.5 font-bold text-zinc-800 dark:text-zinc-200">{row.ticker}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">${fmt(row.price)}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-500">{row.qty}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.sinceAlpha != null ? (
                        <span className={row.sinceAlpha >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                          {row.sinceAlpha >= 0 ? "+" : ""}{row.sinceAlpha.toFixed(1)}%
                        </span>
                      ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400 max-w-[200px] truncate">{row.priority.reason}</td>
                    {target > 0 && <>
                      <td className="py-2.5 text-right tabular-nums">
                        {isTrimmed ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{row.sharesToSell} shares</span>
                        ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {isTrimmed ? (
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">${fmt(row.cashGenerated)}</span>
                        ) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                      </td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[10px] text-zinc-300 dark:text-zinc-600">
        Priority: broken thesis → stop loss hit → take profit hit → bearish + watch → watch → bearish → worst alpha laggards
      </p>
    </div>
  );
}

// ─── Trim Signal Engine ───────────────────────────────────────────────────────
// Scoring based on O'Neil (gain targets), Howard Marks (relative outperformance),
// concentration risk, YTD crossover mean-reversion, and RSI overextension.

// Cooldown days by the action taken at last trim
const TRIM_COOLDOWN_DAYS = { 15: 30, 25: 45, 33: 60, 50: 90 };
// Price must rise at least this much above last trim price before suggesting again
const RETRIGGER_MOVE_PCT = 7;

function getTrimCooldown(row, currentScore) {
  if (!row.last_trim_at) return null; // never trimmed

  const trimmedAt    = new Date(row.last_trim_at + " UTC").getTime();
  const daysSinceTrim = Math.floor((Date.now() - trimmedAt) / 86400000);

  // Derive which cooldown applies from last_trim_price vs unit_cost
  // Use the longest applicable cooldown when we don't know the original trim size
  const cooldownDays = Math.max(...Object.values(TRIM_COOLDOWN_DAYS));
  const daysLeft     = cooldownDays - daysSinceTrim;
  const inCooldown   = daysLeft > 0;

  const lastPrice    = parseFloat(row.last_trim_price) || 0;
  const currentPrice = row.price ?? 0;
  const newMovePct   = lastPrice > 0 && currentPrice > 0
    ? ((currentPrice - lastPrice) / lastPrice) * 100 : null;
  const hasNewMove   = newMovePct != null && newMovePct >= RETRIGGER_MOVE_PCT;

  // Urgent override: score ≥ 86 (thesis broken, stop-loss, multiple signals converging)
  const urgentOverride = currentScore >= 86;

  const suppressed = !urgentOverride && (inCooldown || !hasNewMove);

  return {
    suppressed,
    urgentOverride,
    inCooldown,
    daysLeft: Math.max(0, daysLeft),
    daysSinceTrim,
    cooldownDays,
    lastPrice,
    newMovePct,
    hasNewMove,
    requiredMovePct: RETRIGGER_MOVE_PCT,
  };
}

function computeTrimSignal(row, portfolioValue, macroContext = null) {
  const unitCost  = parseFloat(row.unit_cost) || null;
  const price     = row.price ?? 0;
  const qty       = parseInt(row.quantity) || 0;
  const gainPct   = unitCost && unitCost > 0 && price > 0
    ? ((price - unitCost) / unitCost) * 100 : null;
  const posWeight = portfolioValue > 0
    ? ((price * qty) / portfolioValue) * 100 : null;

  let score = 0;
  const factors = [];

  // 1. Absolute gain since buy (O'Neil CANSLIM: take 20-25% profits mechanically)
  if (gainPct != null) {
    if      (gainPct >= 30) { score += 30; factors.push({ label: `+${gainPct.toFixed(0)}% gain`, pts: 30, src: "O'Neil",    why: "30%+ gain — deep in take-profit zone. CANSLIM: sell your best performers into strength before the reversal. Trying to squeeze the last few % is the most common mistake." }); }
    else if (gainPct >= 20) { score += 22; factors.push({ label: `+${gainPct.toFixed(0)}% gain`, pts: 22, src: "O'Neil",    why: "20-25% gain — O'Neil's primary mechanical take-profit trigger. Lock in gains here; positions that give them back often do so fast." }); }
    else if (gainPct >= 10) { score += 12; factors.push({ label: `+${gainPct.toFixed(0)}% gain`, pts: 12, src: "",          why: "Meaningful unrealized gain. Start planning an exit tranche — protect at least part of it rather than waiting for perfection." }); }
    else if (gainPct >= 5)  { score += 5;  factors.push({ label: `+${gainPct.toFixed(0)}% gain`, pts: 5,  src: "",          why: "Small gain. Hold unless other factors are elevated." }); }
  }

  // 2. Alpha vs SPY since buy (Howard Marks: trim when dramatically outperforming)
  if (row.sinceAlpha != null) {
    if      (row.sinceAlpha >= 20) { score += 25; factors.push({ label: `+${row.sinceAlpha.toFixed(1)}% vs SPY`, pts: 25, src: "Marks",     why: "Dramatically outperforming SPY since purchase. Howard Marks: when a stock is priced for perfection, any miss is punished. Trim while it's loved — not after it disappoints." }); }
    else if (row.sinceAlpha >= 10) { score += 15; factors.push({ label: `+${row.sinceAlpha.toFixed(1)}% vs SPY`, pts: 15, src: "Marks",     why: "Materially beating SPY since purchase. Relative outperformance tends to mean-revert — consider taking some off the table." }); }
    else if (row.sinceAlpha >= 5)  { score += 8;  factors.push({ label: `+${row.sinceAlpha.toFixed(1)}% vs SPY`, pts: 8,  src: "",          why: "Outperforming SPY since buy — good sign, but start watching for reversion." }); }
  }

  // 3. Position concentration (Lynch / risk management)
  if (posWeight != null) {
    if      (posWeight >= 25) { score += 20; factors.push({ label: `${posWeight.toFixed(1)}% of portfolio`, pts: 20, src: "Risk Mgmt",  why: "Over 25% in one stock is significant concentration risk. Lynch: even your highest-conviction idea shouldn't dominate the whole book. Trim to rebalance." }); }
    else if (posWeight >= 15) { score += 12; factors.push({ label: `${posWeight.toFixed(1)}% of portfolio`, pts: 12, src: "Risk Mgmt",  why: "Approaching 15-20% max single-stock weight. Trim to maintain diversification before it becomes a problem." }); }
    else if (posWeight >= 10) { score += 6;  factors.push({ label: `${posWeight.toFixed(1)}% of portfolio`, pts: 6,  src: "",          why: "Above-average weight. Watch if it continues to grow." }); }
  }

  // 4. YTD crossover / mean reversion
  if (row.crossover?.signal === "trim") {
    const pts = row.crossover.upCrossCount >= 3 ? 15 : row.crossover.upCrossCount === 2 ? 10 : 8;
    const histNote = row.crossover.upCrossCount >= 2
      ? ` This stock has crossed SPY ${row.crossover.upCrossCount}× this year — historically a mean-reverting pattern.`
      : "";
    score += pts;
    factors.push({ label: "Just crossed SPY YTD", pts, src: "Mean Reversion", why: `Recaptured SPY year-to-date — classic trim trigger in a rising market.${histNote} In rising-sentiment markets, trim into the momentum, not after it fades.` });
  } else if (row.crossover?.relPerfNow > 10) {
    score += 8;
    factors.push({ label: `+${row.crossover.relPerfNow.toFixed(1)}% ahead of SPY YTD`, pts: 8, src: "Mean Reversion", why: "Running well ahead of SPY for the year. Not an immediate trigger, but start planning a trim target." });
  }

  // 5. RSI overextension
  if (row.mo?.rsi != null) {
    if      (row.mo.rsi >= 75) { score += 10; factors.push({ label: `RSI ${row.mo.rsi.toFixed(0)} — overbought`, pts: 10, src: "Technical", why: "RSI ≥ 75 is statistically overbought. Price has outrun fundamentals — mean reversion is the base case, not the exception. A good time to trim, not add." }); }
    else if (row.mo.rsi >= 65) { score += 5;  factors.push({ label: `RSI ${row.mo.rsi.toFixed(0)} — elevated`,   pts: 5,  src: "Technical", why: "RSI approaching overbought territory (> 70). Not actionable yet — watch." }); }
  }

  // 6. Market sentiment & regime (VIX, Fear & Greed, SPY YTD)
  if (macroContext) {
    const { fearGreedScore, fearGreedRating, regime, spyYtd } = macroContext;
    if (fearGreedScore != null) {
      if (fearGreedScore >= 75) {
        score += 12;
        factors.push({ label: `F&G ${fearGreedScore.toFixed(0)} — ${fearGreedRating ?? "Greed"}`, pts: 12, src: "Sentiment", why: "Market in greed or extreme greed territory. Sentiment peaks historically precede pullbacks. Selling into enthusiasm — not after it fades — is the core of trimming into strength." });
      } else if (fearGreedScore >= 60) {
        score += 6;
        factors.push({ label: `F&G ${fearGreedScore.toFixed(0)} — ${fearGreedRating ?? "Greed"}`, pts: 6, src: "Sentiment", why: "Sentiment tilting greedy. Elevated risk of near-term rotation or pullback as positioning gets crowded." });
      }
    }
    if (spyYtd != null && regime === "risk-on" && spyYtd > 15) {
      score += 10;
      factors.push({ label: `SPY +${spyYtd.toFixed(0)}% YTD (risk-on)`, pts: 10, src: "Market Regime", why: `Extended bull market — SPY up ${spyYtd.toFixed(1)}% YTD in a risk-on regime. Coming from low sentiment to high is historically when outperformers get trimmed. Being above the market is harder to sustain from elevated levels.` });
    } else if (spyYtd != null && spyYtd > 10) {
      score += 6;
      factors.push({ label: `SPY +${spyYtd.toFixed(0)}% YTD`, pts: 6, src: "Market Regime", why: `Strong market year (SPY +${spyYtd.toFixed(1)}% YTD). Continued outperformance from this base is a higher bar.` });
    }
  }

  // 7. Macro thesis driver — flag if the thesis condition is reversing
  if (macroContext?.etfLookup && row.macro_driver && row.macro_driver !== "none") {
    const driver = MACRO_DRIVERS[row.macro_driver];
    if (driver?.etf) {
      const etf = macroContext.etfLookup[driver.etf];
      if (etf?.perfMonth != null) {
        const isReversal = driver.inverseThesis ? etf.perfMonth > 3 : etf.perfMonth < -3;
        const isWarning  = driver.inverseThesis ? etf.perfMonth > 1 : etf.perfMonth < -1;
        if (isReversal) {
          score += 10;
          const dir = driver.inverseThesis ? "rising" : "falling";
          factors.push({ label: `${driver.etf} ${etf.perfMonth > 0 ? "+" : ""}${etf.perfMonth.toFixed(1)}% 1M — thesis at risk`, pts: 10, src: "Macro Thesis", why: `${driver.etf} (${driver.etfName}) is ${dir} sharply this month. Your thesis (${driver.label}) assumes the opposite direction. Consider de-risking while the position is still up.` });
        } else if (isWarning) {
          score += 4;
          const dir = driver.inverseThesis ? "gaining" : "declining";
          factors.push({ label: `${driver.etf} ${etf.perfMonth > 0 ? "+" : ""}${etf.perfMonth.toFixed(1)}% 1M — monitor`, pts: 4, src: "Macro Thesis", why: `${driver.etf} is ${dir} slightly. Not a clear reversal yet, but watch whether the macro thesis conditions continue to hold.` });
        }
      }
    }
  }

  // Core horizon: patient capital, higher bar to trim (halve the score)
  if (row.timeHorizon === "core") score = Math.floor(score * 0.5);
  score = Math.min(100, score);

  let action, trimPct, tranches, approach, color;
  if      (score <= 15) { action = "Hold";   trimPct = 0;  tranches = 0; color = "emerald"; approach = "No action needed. Conditions don't support trimming this month."; }
  else if (score <= 35) { action = "Watch";  trimPct = 0;  tranches = 0; color = "amber";   approach = "Not yet — tighten your mental stop. If score rises next month, act then."; }
  else if (score <= 55) { action = "Trim";   trimPct = 15; tranches = 1; color = "orange";  approach = "Sell 15% in one tranche now. Small, clean action — avoids over-trading while locking in some gain."; }
  else if (score <= 70) { action = "Trim";   trimPct = 25; tranches = 2; color = "orange";  approach = "Sell ~12% now, the rest in 2-3 weeks. Splitting tranches removes the need to nail the exact top — you average out the timing."; }
  else if (score <= 85) { action = "Trim";   trimPct = 33; tranches = 2; color = "red";     approach = "Sell ~17% now, ~17% in 2-3 weeks. You're selling a winner — act before the reversal, not after. Strength is the window."; }
  else                  { action = "Reduce"; trimPct = 50; tranches = 1; color = "red";     approach = "Reduce 50%+ or exit. Multiple signals converging. Sell into this strength — weakness tends to follow, not precede, this pattern."; }

  return { score, action, trimPct, tranches, approach, factors, gainPct, posWeight, color };
}

// ─── Monthly Hold/Sell Review ─────────────────────────────────────────────────

function getMonthlySignal(thesisStatus, mo, roc1m, spyMonthly, timeHorizon = "medium") {
  const alpha1m = roc1m != null && spyMonthly != null ? roc1m - spyMonthly : null;
  const hz = HORIZONS[timeHorizon] ?? HORIZONS.medium;
  const lagThreshold = hz.spyLagThreshold; // null = never flag for SPY lag (core)
  if (thesisStatus === "broken") {
    return { label: "Exit", bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800", dot: "bg-red-500", textColor: "text-red-600 dark:text-red-400", reason: "Thesis broken" };
  }
  const spyLagging = lagThreshold != null && alpha1m !== null && alpha1m < lagThreshold;
  if (thesisStatus === "watch" || mo?.label === "Bearish" || spyLagging) {
    const reasons = [];
    if (thesisStatus === "watch") reasons.push("Thesis on watch");
    if (mo?.label === "Bearish") reasons.push("Bearish momentum");
    if (spyLagging) reasons.push(`Lagging SPY ${Math.abs(alpha1m).toFixed(1)}% (${hz.label} threshold: ${lagThreshold}%)`);
    return { label: "Review", bg: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800", dot: "bg-amber-400", textColor: "text-amber-600 dark:text-amber-400", reason: reasons.join(" · ") };
  }
  const reasons = [];
  if (thesisStatus === "intact") reasons.push("Thesis intact");
  if (mo?.label === "Strong" || mo?.label === "Moderate") reasons.push(`${mo.label} momentum`);
  if (alpha1m !== null && alpha1m > 0) reasons.push(`+${alpha1m.toFixed(1)}% vs SPY`);
  return { label: "Hold", bg: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-400", textColor: "text-emerald-600 dark:text-emerald-400", reason: reasons.join(" · ") };
}

function AlphaTargetInput({ label, value, onSave }) {
  const [val, setVal] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  async function save() {
    const num = parseFloat(val);
    const next = isNaN(num) ? null : num;
    if (next === value) return;
    setSaving(true);
    await onSave(next);
    setSaving(false);
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[9px] text-zinc-400 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="1"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          disabled={saving}
          placeholder="—"
          className="w-14 px-1.5 py-0.5 text-xs text-right rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
        />
        <span className="text-zinc-400 text-xs">%</span>
      </div>
    </div>
  );
}

function getOrderSuggestion(ts, price) {
  // Urgent exits (score 86+, or "reduce") → market order, get out fast
  if (ts.action === "reduce" || ts.score >= 86) {
    return {
      type:       "Market",
      color:      "red",
      limitPrice: null,
      rationale:  "Exit urgently — guaranteed fill matters more than price. Use a market order and accept the spread.",
    };
  }

  // Thesis broken / stop-loss tranche 1 → market order
  const hasBrokenFactor = ts.factors?.some?.((f) => f.label?.toLowerCase().includes("thesis") || f.label?.toLowerCase().includes("stop"));
  if (hasBrokenFactor && ts.score >= 56) {
    return {
      type:       "Market",
      color:      "red",
      limitPrice: null,
      rationale:  "Thesis or stop-loss triggered. Use a market order to ensure execution — slippage risk is lower than the risk of not filling.",
    };
  }

  // High-conviction trim (score 56-85) → limit at current price, don't risk missing fill
  if (ts.score >= 56) {
    const limitPrice = parseFloat(price.toFixed(2));
    return {
      type:       "Limit",
      color:      "amber",
      limitPrice,
      rationale:  `Set a limit order at $${limitPrice.toFixed(2)} (current price). High conviction — don't chase. If not filled within 1 trading day, reassess or lower to market.`,
    };
  }

  // Moderate trim (score 36-55) → limit slightly above current to capture more upside
  if (ts.score >= 36) {
    const bump = ts.gainPct != null && ts.gainPct > 20 ? 0.01 : 0.005; // 1% buffer if large gain, else 0.5%
    const limitPrice = parseFloat((price * (1 + bump)).toFixed(2));
    const pct = (bump * 100).toFixed(1);
    return {
      type:       "Limit",
      color:      "indigo",
      limitPrice,
      rationale:  `Set limit ${pct}% above current at $${limitPrice.toFixed(2)}. Moderate urgency — capture a small premium before selling. Cancel and re-evaluate if not filled in 2–3 trading days.`,
    };
  }

  // Watch / low score → patient limit above current
  const limitPrice = parseFloat((price * 1.01).toFixed(2));
  return {
    type:       "Limit",
    color:      "zinc",
    limitPrice,
    rationale:  `Low urgency — use a limit order at $${limitPrice.toFixed(2)} (+1%) and let the stock come to you. Good-till-cancelled (GTC) order is fine here.`,
  };
}

function SuggestedSale({ row, trimSignal: ts, onUpdate, onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(null); // which tranche was recorded

  const qty      = parseInt(row.quantity) || 0;
  const price    = row.price ?? 0;
  const totalUnits = Math.max(1, Math.round(qty * ts.trimPct / 100));

  // Split into tranches if recommended
  const t1Units = ts.tranches > 1 ? Math.ceil(totalUnits / 2)  : totalUnits;
  const t2Units = ts.tranches > 1 ? totalUnits - t1Units        : 0;

  async function recordSale(units, trancheLabel) {
    if (recording || units <= 0) return;
    setRecording(true);
    const newQty = Math.max(0, qty - units);
    await Promise.all([
      fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: row.ticker, quantity: newQty }),
      }),
      fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker:    row.ticker,
          units,
          price:     row.price,
          unit_cost: parseFloat(row.unit_cost) || null,
          added_at:  row.added_at,
        }),
      }),
    ]);
    onUpdate(row.ticker, "quantity", newQty);
    onRecorded?.();
    setRecorded(trancheLabel);
    setRecording(false);
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Suggested Sale — {ts.action} {ts.trimPct}%
        </p>
        <span className="text-[10px] text-zinc-400 tabular-nums">{qty} shares held · ${price > 0 ? price.toFixed(2) : "—"}</span>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-4 items-center">
        {ts.tranches <= 1 ? (
          /* Single tranche */
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Sell</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">{totalUnits} shares</p>
            </div>
            <div>
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Est. Cash</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">${(totalUnits * price).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Remaining</p>
              <p className="text-sm font-semibold text-zinc-500 tabular-nums">{Math.max(0, qty - totalUnits)} shares</p>
            </div>
            {recorded === "t1" ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Recorded — {Math.max(0, qty - totalUnits)} shares remaining</span>
            ) : (
              <button
                onClick={() => recordSale(totalUnits, "t1")}
                disabled={recording}
                className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors bg-zinc-800 dark:bg-zinc-100 border-zinc-800 dark:border-zinc-100 text-white dark:text-zinc-900 hover:opacity-80 disabled:opacity-40"
              >
                {recording ? "Saving…" : "Record (Pending)"}
              </button>
            )}
          </div>
        ) : (
          /* Two tranches */
          <div className="flex flex-wrap gap-5">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Tranche 1 — now</p>
                <p className="text-base font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">{t1Units} shares</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">${(t1Units * price).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              {recorded === "t1" ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Recorded</span>
              ) : (
                <button
                  onClick={() => recordSale(t1Units, "t1")}
                  disabled={recording}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors bg-zinc-800 dark:bg-zinc-100 border-zinc-800 dark:border-zinc-100 text-white dark:text-zinc-900 hover:opacity-80 disabled:opacity-40"
                >
                  {recording ? "Saving…" : "Record T1 (Pending)"}
                </button>
              )}
            </div>
            <div className="w-px bg-zinc-200 dark:bg-zinc-700 self-stretch" />
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Tranche 2 — in 2–3 weeks</p>
                <p className="text-base font-bold text-zinc-500 tabular-nums">{t2Units} shares</p>
                <p className="text-[10px] text-zinc-400 tabular-nums">${(t2Units * price).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              {recorded === "t2" ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Recorded</span>
              ) : (
                <button
                  onClick={() => recordSale(t2Units, "t2")}
                  disabled={recording}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
                >
                  {recording ? "Saving…" : "Record T2 (Pending)"}
                </button>
              )}
            </div>
            <div className="self-center text-[10px] text-zinc-400">
              Total: {totalUnits} shares · ${(totalUnits * price).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} · {Math.max(0, qty - totalUnits)} remaining
            </div>
          </div>
        )}
      </div>

      {/* Order type recommendation */}
      {price > 0 && (() => {
        const order = getOrderSuggestion(ts, price);
        const styles = {
          red:    "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
          amber:  "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
          indigo: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300",
          zinc:   "bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300",
        };
        const badgeStyles = {
          red:    "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
          amber:  "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
          indigo: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
          zinc:   "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300",
        };
        return (
          <div className={`px-4 py-3 border-t flex items-start gap-3 ${styles[order.color]}`}>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${badgeStyles[order.color]}`}>
              {order.type === "Market" ? "MARKET ORDER" : "LIMIT ORDER"}
            </span>
            <div className="flex-1 min-w-0">
              {order.limitPrice != null && (
                <p className="text-xs font-semibold tabular-nums mb-0.5">
                  Suggested limit: ${order.limitPrice.toFixed(2)}
                  <span className="font-normal text-[10px] opacity-70 ml-1">
                    (current ${price.toFixed(2)}{order.limitPrice !== price ? ` · ${((order.limitPrice / price - 1) * 100).toFixed(1)}%` : ""})
                  </span>
                </p>
              )}
              <p className="text-[11px] opacity-90">{order.rationale}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MonthlyReview({ items, momentum, autoThesis, spyMonthly, spySinceInception, livePrices, crossovers, onUpdate, totalValue, macro, etfData, pendingTickers = new Set(), onTradeRecorded }) {
  const [expanded, setExpanded] = useState(new Set());

  // Build ETF lookup: prefer the fast dedicated etfData endpoint, fall back to macro subsectors
  function buildFastEtfLookup() {
    if (etfData && Object.keys(etfData).length > 0) {
      // etfData shape: { XOP: { ytd, month }, JETS: { ytd, month }, ... }
      // Normalise to same shape expected by driver panel: perfMonth, perfYTD
      const lookup = {};
      for (const [sym, d] of Object.entries(etfData)) {
        lookup[sym] = { perfMonth: d.month, perfYTD: d.ytd };
      }
      // Merge full macro ETF data on top (in case macro loaded too)
      for (const [sym, d] of Object.entries(buildEtfLookup(macro))) {
        if (!lookup[sym]) lookup[sym] = d;
      }
      return lookup;
    }
    return buildEtfLookup(macro);
  }

  const macroContext = (macro || etfData) ? {
    fearGreedScore:  macro?.sentiment?.fearGreedScore  ?? null,
    fearGreedRating: macro?.sentiment?.fearGreedRating ?? null,
    regime:          macro?.regime ?? null,
    spyYtd:          macro?.spy?.perfYTD ?? null,
    vix:             macro?.vix ?? null,
    etfLookup:       buildFastEtfLookup(),
  } : null;

  const rows = items.map((item) => {
    const mo          = momentum[item.ticker];
    const thesis      = autoThesis[item.ticker];
    const roc1m       = mo?.roc1m ?? null;
    const alpha1m     = roc1m != null && spyMonthly != null ? roc1m - spyMonthly : null;
    const price       = livePrices[item.ticker]?.price ?? parseFloat(item.price) ?? 0;
    const unitCost    = parseFloat(item.unit_cost) || null;
    const sinceReturn = unitCost && price > 0 ? ((price - unitCost) / unitCost) * 100 : null;
    const sinceAlpha  = sinceReturn != null && spySinceInception != null ? sinceReturn - spySinceInception : null;
    const targetUp    = item.alpha_target_up   != null ? parseFloat(item.alpha_target_up)   : null;
    const targetDown  = item.alpha_target_down != null ? parseFloat(item.alpha_target_down) : null;
    const timeHorizon = item.time_horizon ?? "medium";
    const takeProfitHit = targetUp != null && sinceAlpha != null && sinceAlpha >= targetUp;
    const hz = HORIZONS[timeHorizon] ?? HORIZONS.medium;
    const effectiveStop = targetDown != null ? Math.abs(targetDown) : (hz.stopLossAlpha != null ? Math.abs(hz.stopLossAlpha) : null);
    const stopLossHit = effectiveStop != null && sinceAlpha != null && sinceAlpha <= -effectiveStop;
    const signal      = getMonthlySignal(thesis?.status ?? null, mo ?? null, roc1m, spyMonthly, timeHorizon);
    const crossover   = crossovers[item.ticker] ?? null;
    const qty         = parseInt(item.quantity) || 0;
    const rowData     = { ...item, mo, thesis, roc1m, alpha1m, sinceAlpha, targetUp, targetDown, takeProfitHit, stopLossHit, signal, crossover, timeHorizon, price, quantity: qty };
    const trimSignal  = computeTrimSignal(rowData, totalValue ?? 0, macroContext);
    const trimCooldown = getTrimCooldown(rowData, trimSignal.score);
    return { ...rowData, trimSignal, trimCooldown };
  }).sort((a, b) => {
    if (a.signal.label === "Exit"  && b.signal.label !== "Exit") return -1;
    if (b.signal.label === "Exit"  && a.signal.label !== "Exit") return 1;
    if (a.takeProfitHit !== b.takeProfitHit) return a.takeProfitHit ? -1 : 1;
    if (a.stopLossHit   !== b.stopLossHit)   return a.stopLossHit   ? -1 : 1;
    return b.trimSignal.score - a.trimSignal.score;
  });

  const trimCount   = rows.filter((r) => ["Trim","Reduce"].includes(r.trimSignal.action)).length;
  const exitCount   = rows.filter((r) => r.signal.label === "Exit").length;
  const targetCount = rows.filter((r) => r.takeProfitHit || r.stopLossHit).length;

  const CLR = {
    emerald: { bar: "bg-emerald-500", badge: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300", text: "text-emerald-600 dark:text-emerald-400" },
    amber:   { bar: "bg-amber-400",   badge: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",             text: "text-amber-600 dark:text-amber-400"   },
    orange:  { bar: "bg-orange-500",  badge: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",       text: "text-orange-600 dark:text-orange-400" },
    red:     { bar: "bg-red-500",     badge: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",                         text: "text-red-600 dark:text-red-400"       },
  };

  function toggleRow(ticker) {
    setExpanded((prev) => { const n = new Set(prev); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n; });
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">
          Monthly Hold / Sell Review
        </p>
        <div className="flex items-center gap-3 text-xs">
          {exitCount   > 0 && <span className="text-red-500 font-semibold">{exitCount} Exit</span>}
          {targetCount > 0 && <span className="text-violet-500 font-semibold">{targetCount} Target Hit</span>}
          {trimCount   > 0 && <span className="text-orange-500 font-semibold">{trimCount} Trim</span>}
        </div>
      </div>
      <p className="text-xs text-zinc-400 mb-0.5">
        Trim score (0–100): gain since buy (O'Neil) · alpha vs SPY (Marks) · concentration · YTD crossover · RSI · market sentiment · macro thesis.
        {spyMonthly != null && <span> · SPY 1M: <span className={spyMonthly >= 0 ? "text-emerald-500" : "text-red-400"}>{spyMonthly >= 0 ? "+" : ""}{spyMonthly.toFixed(1)}%</span></span>}
      </p>
      <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mb-3">
        Tranche selling spreads timing risk — split recommended trims into 2 smaller sells 2–3 weeks apart instead of trying to pick the exact top. Click any row to see factor breakdown.
      </p>

      {/* Macro context banner */}
      {macroContext && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-xs flex flex-wrap items-start gap-x-6 gap-y-2 ${
          macroContext.regime === "risk-on"  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900" :
          macroContext.regime === "risk-off" ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900" :
                                               "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        }`}>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Market Regime</p>
            <p className={`font-bold text-sm ${macroContext.regime === "risk-on" ? "text-emerald-600 dark:text-emerald-400" : macroContext.regime === "risk-off" ? "text-red-500" : "text-zinc-500"}`}>
              {macroContext.regime === "risk-on" ? "Risk-On" : macroContext.regime === "risk-off" ? "Risk-Off" : "Neutral"}
            </p>
          </div>
          {macroContext.vix != null && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">VIX</p>
              <p className={`font-bold text-sm tabular-nums ${macroContext.vix < 18 ? "text-emerald-600 dark:text-emerald-400" : macroContext.vix > 25 ? "text-red-500" : "text-amber-500"}`}>
                {macroContext.vix.toFixed(1)}
                <span className="text-[10px] font-normal ml-1 text-zinc-400">{macroContext.vix < 18 ? "low fear" : macroContext.vix > 25 ? "elevated" : "moderate"}</span>
              </p>
            </div>
          )}
          {macroContext.fearGreedScore != null && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Fear &amp; Greed</p>
              <p className={`font-bold text-sm tabular-nums ${macroContext.fearGreedScore >= 75 ? "text-red-500" : macroContext.fearGreedScore >= 55 ? "text-orange-500" : macroContext.fearGreedScore <= 35 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                {macroContext.fearGreedScore.toFixed(0)}
                <span className="text-[10px] font-normal ml-1 text-zinc-400">{macroContext.fearGreedRating ?? ""}</span>
              </p>
            </div>
          )}
          {macroContext.spyYtd != null && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">SPY YTD</p>
              <p className={`font-bold text-sm tabular-nums ${macroContext.spyYtd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {macroContext.spyYtd >= 0 ? "+" : ""}{macroContext.spyYtd.toFixed(1)}%
              </p>
            </div>
          )}
          {macroContext.regime === "risk-on" && (macroContext.fearGreedScore ?? 0) >= 60 && (
            <div className="w-full">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Market transitioning from low sentiment to high — rising sentiment + risk-on regime is historically the optimal window to trim outperformers into strength.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="pb-2 w-5" />
              <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wider">Ticker</th>
              <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">Gain</th>
              <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">vs SPY</th>
              <th className="pb-2 text-right font-semibold text-zinc-400 uppercase tracking-wider">1M α</th>
              <th className="pb-2 text-center font-semibold text-zinc-400 uppercase tracking-wider">Trim Score</th>
              <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wider">Action</th>
              <th className="pb-2 text-left font-semibold text-zinc-400 uppercase tracking-wider">Approach</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ts  = row.trimSignal;
              const clr = CLR[ts.color] ?? CLR.emerald;
              const isOpen = expanded.has(row.ticker);
              const isExit = row.signal.label === "Exit";
              return (
                <Fragment key={row.ticker}>
                  <tr
                    onClick={() => toggleRow(row.ticker)}
                    className={`border-b border-zinc-50 dark:border-zinc-900 cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors ${
                      isExit          ? "bg-red-50/30 dark:bg-red-950/10" :
                      row.takeProfitHit ? "bg-violet-50/30 dark:bg-violet-950/10" :
                      row.stopLossHit   ? "bg-red-50/20 dark:bg-red-950/10" : ""
                    }`}
                  >
                    {/* Expand chevron */}
                    <td className="py-3 pr-1">
                      <svg className={`w-3 h-3 text-zinc-300 dark:text-zinc-600 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>

                    {/* Ticker + badges */}
                    <td className="py-3 font-bold text-zinc-800 dark:text-zinc-200">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {row.ticker}
                          {isExit          && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 uppercase">Exit</span>}
                          {row.takeProfitHit && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 uppercase">Take Profit ✓</span>}
                          {row.stopLossHit && !isExit && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 uppercase">Stop Loss ✓</span>}
                        </div>
                        {(() => { const hz = HORIZONS[row.timeHorizon] ?? HORIZONS.medium; return <span className={`inline-flex w-fit px-1.5 py-0.5 rounded-full border text-[9px] font-semibold ${hz.color}`}>{hz.label}</span>; })()}
                      </div>
                    </td>

                    {/* Gain since buy */}
                    <td className="py-3 text-right tabular-nums">
                      {ts.gainPct != null
                        ? <span className={`font-semibold ${ts.gainPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{ts.gainPct >= 0 ? "+" : ""}{ts.gainPct.toFixed(1)}%</span>
                        : <span className="text-zinc-300 dark:text-zinc-600 text-[10px]">enter cost</span>}
                    </td>

                    {/* Since-buy alpha vs SPY */}
                    <td className="py-3 text-right tabular-nums">
                      {row.sinceAlpha != null
                        ? <span className={row.sinceAlpha >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>{row.sinceAlpha >= 0 ? "+" : ""}{row.sinceAlpha.toFixed(1)}%</span>
                        : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>

                    {/* 1M alpha */}
                    <td className="py-3 text-right tabular-nums">
                      {row.alpha1m != null
                        ? <span className={row.alpha1m >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>{row.alpha1m >= 0 ? "+" : ""}{row.alpha1m.toFixed(1)}%</span>
                        : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>

                    {/* Trim Score bar */}
                    <td className="py-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div className={`h-full rounded-full ${clr.bar}`} style={{ width: `${ts.score}%` }} />
                          </div>
                          <span className={`text-xs font-bold tabular-nums ${clr.text}`}>{ts.score}</span>
                        </div>
                        {ts.factors.length > 0 && <span className="text-[9px] text-zinc-400">{ts.factors.length} factor{ts.factors.length > 1 ? "s" : ""}</span>}
                      </div>
                    </td>

                    {/* Action badge */}
                    <td className="py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${clr.badge}`}>
                          {ts.action}{ts.trimPct > 0 ? ` ${ts.trimPct}%` : ""}
                        </span>
                        {ts.tranches > 1 && <span className="text-[9px] text-zinc-400 pl-0.5">{ts.tranches} tranches</span>}
                      </div>
                    </td>

                    {/* Approach hint */}
                    <td className="py-3 text-zinc-400 text-[10px] max-w-[200px] leading-relaxed">{ts.approach}</td>
                  </tr>

                  {/* Expanded: factor breakdown + alpha targets + thesis signal */}
                  {isOpen && (
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <td colSpan={8} className="px-4 py-5 bg-zinc-50/60 dark:bg-zinc-900/30">
                        <div className="flex flex-col gap-5">

                          {/* Factor breakdown */}
                          {ts.factors.length > 0 ? (
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Why this score — {ts.score} / 100</p>
                              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px]">
                                      <th className="px-3 py-1.5 text-left font-semibold text-zinc-500 uppercase tracking-wider">Factor</th>
                                      <th className="px-3 py-1.5 text-center font-semibold text-zinc-500 uppercase tracking-wider w-10">Pts</th>
                                      <th className="px-3 py-1.5 text-left font-semibold text-zinc-500 uppercase tracking-wider w-24">Source</th>
                                      <th className="px-3 py-1.5 text-left font-semibold text-zinc-500 uppercase tracking-wider">Rationale</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ts.factors.map((f, i) => (
                                      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                                        <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{f.label}</td>
                                        <td className="px-3 py-2 text-center"><span className={`font-bold ${clr.text}`}>+{f.pts}</span></td>
                                        <td className="px-3 py-2 text-zinc-400 italic text-[10px] whitespace-nowrap">{f.src || "—"}</td>
                                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.why}</td>
                                      </tr>
                                    ))}
                                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                                      <td className="px-3 py-2 font-bold text-zinc-600 dark:text-zinc-300">Total</td>
                                      <td className="px-3 py-2 text-center font-bold text-zinc-800 dark:text-zinc-100 tabular-nums">{ts.score}</td>
                                      <td colSpan={2} className="px-3 py-2 text-[10px] text-zinc-400 italic">{row.timeHorizon === "core" ? "Core position — score halved (patient capital)" : ""}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400">
                              {ts.gainPct == null ? "Enter unit cost to unlock gain-based scoring." : "No trim factors triggered. All signals within normal range."}
                            </p>
                          )}

                          {/* Suggested Sale — with cooldown guard */}
                          {ts.trimPct > 0 && row.quantity > 0 && (() => {
                            const cd = row.trimCooldown;

                            // Already have a pending trade for this ticker
                            if (pendingTickers.has(row.ticker)) {
                              return (
                                <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-700 dark:text-amber-300">
                                  <span>⏳</span>
                                  <span>Sale already pending for {row.ticker} — confirm or reverse it on the <a href="/trades" className="underline font-semibold">Tax page</a> before recording another.</span>
                                </div>
                              );
                            }

                            // Cooldown or price hasn't reset — suppress unless urgent
                            if (cd?.suppressed) {
                              return (
                                <div className="px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-500 space-y-1">
                                  <p className="font-semibold text-zinc-600 dark:text-zinc-300">Trim cooldown active</p>
                                  <p>
                                    Last trimmed <strong>{cd.daysSinceTrim}d ago</strong>.
                                    {cd.inCooldown && <span> Cooldown ends in <strong>{cd.daysLeft}d</strong> ({cd.cooldownDays}-day window after a trim).</span>}
                                  </p>
                                  {!cd.hasNewMove && cd.newMovePct != null && (
                                    <p>
                                      Price is <strong>{cd.newMovePct >= 0 ? "+" : ""}{cd.newMovePct.toFixed(1)}%</strong> vs last trim price ${cd.lastPrice.toFixed(2)}.
                                      Needs <strong>+{cd.requiredMovePct}%</strong> new move to re-trigger — currently <strong>{(cd.requiredMovePct - cd.newMovePct).toFixed(1)}% short</strong>.
                                    </p>
                                  )}
                                  <p className="text-zinc-400">Both conditions must be met: cooldown expired + {cd.requiredMovePct}% new gain from ${cd.lastPrice.toFixed(2)}.</p>
                                </div>
                              );
                            }

                            // Re-triggered after cooldown — show with context
                            return (
                              <>
                                {cd && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">
                                    ✓ Cooldown cleared ({cd.daysSinceTrim}d since last trim) · +{cd.newMovePct?.toFixed(1)}% new move since last trim price ${cd.lastPrice.toFixed(2)}
                                  </p>
                                )}
                                <SuggestedSale row={row} trimSignal={ts} onUpdate={onUpdate} onRecorded={() => onTradeRecorded?.(row.ticker)} />
                              </>
                            );
                          })()}

                          {/* Macro Driver Panel */}
                          {(() => {
                            const driverKey = row.macro_driver && MACRO_DRIVERS[row.macro_driver] ? row.macro_driver : "none";
                            const driver = MACRO_DRIVERS[driverKey];
                            const etfData = driver?.etf && macroContext?.etfLookup ? macroContext.etfLookup[driver.etf] : null;
                            const isReversal = etfData?.perfMonth != null && (driver.inverseThesis ? etfData.perfMonth > 3 : etfData.perfMonth < -3);
                            const isWarning  = etfData?.perfMonth != null && !isReversal && (driver.inverseThesis ? etfData.perfMonth > 1 : etfData.perfMonth < -1);
                            const jetsData  = macroContext?.etfLookup?.["JETS"];
                            const showJets  = driverKey === "oil_falling" && jetsData;
                            const cpiEnergy = macro?.inflation?.components?.find?.((c) => c.name === "Energy");
                            return (
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Macro Driver</p>
                                  <MacroDriverSelector
                                    value={row.macro_driver}
                                    onSave={async (val) => {
                                      await fetch("/api/watchlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: row.ticker, macro_driver: val }) });
                                      onUpdate(row.ticker, "macro_driver", val);
                                    }}
                                  />
                                </div>
                                {driverKey !== "none" && (
                                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-1">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px]">
                                          <th className="px-3 py-1.5 text-left font-semibold text-zinc-500 uppercase tracking-wider">Signal</th>
                                          <th className="px-3 py-1.5 text-right font-semibold text-zinc-500 uppercase tracking-wider w-16">1M</th>
                                          <th className="px-3 py-1.5 text-right font-semibold text-zinc-500 uppercase tracking-wider w-16">YTD</th>
                                          <th className="px-3 py-1.5 text-left font-semibold text-zinc-500 uppercase tracking-wider">Thesis Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {etfData && (
                                          <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                                            <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">{driver.etf} <span className="text-zinc-400 font-normal text-[10px]">{driver.etfName}</span></td>
                                            <td className={`px-3 py-2 text-right tabular-nums font-semibold ${etfData.perfMonth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{etfData.perfMonth != null ? `${etfData.perfMonth >= 0 ? "+" : ""}${etfData.perfMonth.toFixed(1)}%` : "—"}</td>
                                            <td className={`px-3 py-2 text-right tabular-nums ${etfData.perfYTD >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{etfData.perfYTD != null ? `${etfData.perfYTD >= 0 ? "+" : ""}${etfData.perfYTD.toFixed(1)}%` : "—"}</td>
                                            <td className="px-3 py-2">
                                              {isReversal
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-[10px] font-semibold text-red-600 dark:text-red-400">Thesis at Risk</span>
                                                : isWarning
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-600 dark:text-amber-400">Monitor</span>
                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Confirming</span>}
                                            </td>
                                          </tr>
                                        )}
                                        {showJets && (
                                          <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                                            <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">JETS <span className="text-zinc-400 font-normal text-[10px]">Airlines ETF</span></td>
                                            <td className={`px-3 py-2 text-right tabular-nums font-semibold ${jetsData.perfMonth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{jetsData.perfMonth != null ? `${jetsData.perfMonth >= 0 ? "+" : ""}${jetsData.perfMonth.toFixed(1)}%` : "—"}</td>
                                            <td className={`px-3 py-2 text-right tabular-nums ${jetsData.perfYTD >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{jetsData.perfYTD != null ? `${jetsData.perfYTD >= 0 ? "+" : ""}${jetsData.perfYTD.toFixed(1)}%` : "—"}</td>
                                            <td className="px-3 py-2">
                                              {jetsData.perfMonth >= 0
                                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Airlines rising — confirming</span>
                                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-600 dark:text-amber-400">Airlines softening</span>}
                                            </td>
                                          </tr>
                                        )}
                                        {cpiEnergy && driverKey === "oil_falling" && (
                                          <tr>
                                            <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-300">Energy CPI <span className="text-zinc-400 font-normal text-[10px]">Inflation</span></td>
                                            <td className={`px-3 py-2 text-right tabular-nums ${cpiEnergy.mom <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{cpiEnergy.mom != null ? `${cpiEnergy.mom >= 0 ? "+" : ""}${cpiEnergy.mom.toFixed(2)}% MoM` : "—"}</td>
                                            <td className={`px-3 py-2 text-right tabular-nums ${cpiEnergy.yoy <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>{cpiEnergy.yoy != null ? `${cpiEnergy.yoy >= 0 ? "+" : ""}${cpiEnergy.yoy.toFixed(1)}% YoY` : "—"}</td>
                                            <td className="px-3 py-2">
                                              {cpiEnergy.trend === "decelerating"
                                                ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Decelerating — thesis intact</span>
                                                : cpiEnergy.trend === "accelerating"
                                                ? <span className="text-[10px] text-red-500 font-semibold">Accelerating — thesis at risk</span>
                                                : <span className="text-[10px] text-zinc-400">Stable</span>}
                                            </td>
                                          </tr>
                                        )}
                                        {!etfData && !showJets && !cpiEnergy && (
                                          <tr>
                                            <td colSpan={4} className="px-3 py-3 text-center text-xs text-zinc-400">
                                              {macroContext
                                                ? "ETF data not available for this driver"
                                                : <span className="animate-pulse">Loading macro data…</span>}
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                    {driver.thesisDesc && (
                                      <p className="px-3 py-2 text-[10px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">{driver.thesisDesc}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Bottom row: alpha targets + thesis signal + YTD data */}
                          <div className="flex flex-wrap gap-6 items-start">
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Alpha Targets (since-buy α vs SPY)</p>
                              <div className="flex items-center gap-4">
                                <AlphaTargetInput label="Take Profit ↑" value={row.alpha_target_up}
                                  onSave={async (val) => {
                                    await fetch("/api/watchlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: row.ticker, alpha_target_up: val }) });
                                    onUpdate(row.ticker, "alpha_target_up", val);
                                  }}
                                />
                                <AlphaTargetInput label="Stop Loss ↓" value={row.alpha_target_down}
                                  onSave={async (val) => {
                                    await fetch("/api/watchlist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: row.ticker, alpha_target_down: val }) });
                                    onUpdate(row.ticker, "alpha_target_down", val);
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Thesis Signal</p>
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${row.signal.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${row.signal.dot}`} />
                                <span className={row.signal.textColor}>{row.signal.label}</span>
                              </span>
                              {row.signal.reason && <p className="text-[10px] text-zinc-400 mt-1 max-w-[260px]">{row.signal.reason}</p>}
                            </div>
                            {row.crossover?.stockYtd != null && (
                              <div>
                                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">YTD vs SPY</p>
                                <p className="text-[10px] text-zinc-500 tabular-nums">
                                  {row.ticker}: <span className={row.crossover.stockYtd >= 0 ? "text-emerald-500 font-semibold" : "text-red-400 font-semibold"}>{row.crossover.stockYtd >= 0 ? "+" : ""}{row.crossover.stockYtd.toFixed(1)}%</span>
                                  {" · "}SPY: <span className={row.crossover.spyYtd >= 0 ? "text-emerald-500" : "text-red-400"}>{row.crossover.spyYtd >= 0 ? "+" : ""}{row.crossover.spyYtd.toFixed(1)}%</span>
                                </p>
                                {row.crossover.signal === "trim" && <p className="text-[10px] text-violet-500 mt-0.5">↑ Crossed SPY · {row.crossover.daysAgoUp === 0 ? "today" : `${row.crossover.daysAgoUp}d ago`}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-zinc-300 dark:text-zinc-600">
        Gain = price return since unit cost · vs SPY = since-buy alpha vs SPY return since inception · Core positions score is halved (patient capital)
      </p>
    </div>
  );
}

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perf, setPerf] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [growth, setGrowth] = useState(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const crossovers = growth?.crossovers ?? {};
  const [macro, setMacro] = useState(null);
  const [etfData, setEtfData] = useState(null);
  const [pendingTickers, setPendingTickers] = useState(new Set());
  const [projection, setProjection] = useState(null);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [livePrices, setLivePrices] = useState({});
  const [momentum, setMomentum] = useState({});
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

      // Fetch momentum scores (6h cached)
      fetch("/api/watchlist/momentum")
        .then((r) => r.json())
        .then((rows) => {
          const map = {};
          for (const row of rows) map[row.ticker] = row;
          setMomentum(map);
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

      setGrowthLoading(true);
      fetch("/api/watchlist/growth")
        .then((r) => r.json())
        .then(setGrowth)
        .finally(() => setGrowthLoading(false));

      setProjectionLoading(true);
      fetch("/api/watchlist/projection")
        .then((r) => r.json())
        .then(setProjection)
        .finally(() => setProjectionLoading(false));

      // Pending trades — suppress duplicate trim suggestions
      fetch("/api/trades")
        .then((r) => r.json())
        .then((trades) => {
          const pending = new Set(
            (Array.isArray(trades) ? trades : [])
              .filter((t) => t.status === "pending")
              .map((t) => t.ticker)
          );
          setPendingTickers(pending);
        })
        .catch(() => {});

      // Fast ETF data for macro driver panels (30-min cache, loads in seconds)
      fetch("/api/watchlist/etf-data")
        .then((r) => r.json())
        .then(setEtfData)
        .catch(() => {});

      // Full macro data for sentiment + regime context (6h cached, slow first load)
      fetch("/api/macro")
        .then((r) => r.json())
        .then(setMacro)
        .catch(() => {});
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

        {/* Growth of $10K */}
        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">
                Growth of $10,000
              </p>
              {growth?.fetchedAt && (
                <span className="text-xs text-zinc-400">
                  Cached · {new Date(growth.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              {growthLoading && !growth
                ? "Fetching price history…"
                : "Hypothetical $10K invested 1 year ago · SPY shown as dashed benchmark · Data cached 6 hrs"}
            </p>
            {growthLoading && !growth ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-sm text-zinc-400 animate-pulse">Loading chart…</p>
              </div>
            ) : growth?.chartData?.length > 0 ? (
              <GrowthChart chartData={growth.chartData} />
            ) : (
              <p className="text-sm text-zinc-400 py-4 text-center">No price history available.</p>
            )}
          </div>
        )}

        {/* 5-Year Projection */}
        {!loading && items.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase">
                5-Year Projection
              </p>
              {projection?.fetchedAt && (
                <span className="text-xs text-zinc-400">
                  Cached · {new Date(projection.fetchedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              {projectionLoading && !projection
                ? "Fetching analyst estimates…"
                : "Hypothetical $10K compounded at analyst EPS CAGR · Bull / Base / Bear scenarios · Data cached 6 hrs"}
            </p>
            {projectionLoading && !projection ? (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-sm text-zinc-400 animate-pulse">Loading projection…</p>
              </div>
            ) : projection?.chartData?.length > 0 ? (
              <ProjectionChart
                portfolioCAGR={projection.portfolioCAGR}
                scenarios={projection.scenarios}
                positions={projection.positions}
                chartData={projection.chartData}
              />
            ) : (
              <p className="text-sm text-zinc-400 py-4 text-center">No analyst growth data available.</p>
            )}
          </div>
        )}

        {/* Monthly Sell Plan */}
        {!loading && items.length > 0 && (
          <MonthlySellPlan
            items={items}
            momentum={momentum}
            autoThesis={autoThesis}
            livePrices={livePrices}
            spySinceInception={perf?.sinceInception?.spyReturn ?? null}
            crossovers={crossovers}
            onUpdate={handleFieldUpdate}
          />
        )}

        {/* Monthly Hold/Sell Review */}
        {!loading && items.length > 0 && Object.keys(momentum).length > 0 && (
          <MonthlyReview
            items={items}
            momentum={momentum}
            autoThesis={autoThesis}
            spyMonthly={perf?.spy?.["Perf Month"] ?? null}
            spySinceInception={perf?.sinceInception?.spyReturn ?? null}
            livePrices={livePrices}
            crossovers={crossovers}
            onUpdate={handleFieldUpdate}
            totalValue={totalValue}
            macro={macro}
            etfData={etfData}
            pendingTickers={pendingTickers}
            onTradeRecorded={(ticker) => setPendingTickers((prev) => new Set([...prev, ticker]))}
          />
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
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500">Momentum</th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-500">Horizon</th>
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
                      <td className="px-4 py-4">
                        {(() => {
                          const mo = momentum[item.ticker];
                          if (!mo) return <span className="text-zinc-300 dark:text-zinc-600 text-xs animate-pulse">…</span>;
                          const STYLE = {
                            Strong:   "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
                            Moderate: "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
                            Weak:     "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
                            Bearish:  "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
                          };
                          const DOT = { Strong: "bg-emerald-500", Moderate: "bg-indigo-500", Weak: "bg-zinc-400", Bearish: "bg-red-500" };
                          const cls = STYLE[mo.label] ?? STYLE.Weak;
                          const dot = DOT[mo.label]   ?? DOT.Weak;
                          return (
                            <div
                              className={`inline-flex flex-col gap-0.5 cursor-default`}
                              title={`RSI: ${mo.rsi ?? "—"} · SMA50: ${mo.sma50Pct != null ? (mo.sma50Pct > 0 ? "+" : "") + mo.sma50Pct + "%" : "—"} · SMA200: ${mo.sma200Pct != null ? (mo.sma200Pct > 0 ? "+" : "") + mo.sma200Pct + "%" : "—"} · 1M: ${mo.roc1m != null ? (mo.roc1m > 0 ? "+" : "") + mo.roc1m + "%" : "—"}`}
                            >
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                {mo.label}
                              </span>
                              <span className="text-[10px] text-zinc-400 tabular-nums pl-0.5">{mo.score}/100</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        <HorizonSelector
                          value={item.time_horizon ?? "medium"}
                          onSave={async (key) => {
                            await fetch("/api/watchlist", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ticker: item.ticker, time_horizon: key }),
                            });
                            handleFieldUpdate(item.ticker, "time_horizon", key);
                          }}
                        />
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
                    <td colSpan={6} className="px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
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
