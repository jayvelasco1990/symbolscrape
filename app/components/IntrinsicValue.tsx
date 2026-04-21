"use client";
import { useState } from "react";

interface SectorBenchmark { cheap: number; fair: number }

const SECTOR_EVEB: Record<string, SectorBenchmark | null> = {
  "Technology":             { cheap: 15, fair: 25 },
  "Health Care":            { cheap: 12, fair: 18 },
  "Healthcare":             { cheap: 12, fair: 18 },
  "Energy":                 { cheap: 5,  fair: 8  },
  "Utilities":              { cheap: 8,  fair: 12 },
  "Industrials":            { cheap: 9,  fair: 14 },
  "Consumer Defensive":     { cheap: 10, fair: 14 },
  "Consumer Cyclical":      { cheap: 9,  fair: 13 },
  "Basic Materials":        { cheap: 7,  fair: 11 },
  "Communication Services": { cheap: 8,  fair: 12 },
  "Financial":              null, // debt is core to business model
  "Financial Services":     null,
  "Real Estate":            null, // use EV/FFO instead
};
const DEFAULT_EVEB: SectorBenchmark = { cheap: 10, fair: 15 };

interface Props {
  price: string;
  fairValue: string;
  formula?: string;
  note?: string;
  netCashPerShare?: string;
  evEbitda?: string;
  fcfYield?: number | null;
  sector?: string;
  bearCase?: { price: string; troughPe: number; troughPs: number; eps: string; epsLabel: string; beta: number; psRatio: string | null; fcfConversionPct: number | null; week52High: number | null; week52Low: number | null; method: string } | null;
}

function parseNum(s: string) {
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(a: number, b: number) {
  return b > 0 ? ((a - b) / b) * 100 : null;
}

function PctVsCurrent({ bear, current }: { bear: number; current: number }) {
  const d = pct(bear, current);
  if (d === null) return null;
  const isAbove = d >= 0;
  return (
    <span className={`text-[10px] font-semibold ${isAbove ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
      {isAbove ? "+" : ""}{d.toFixed(1)}% vs ${current.toFixed(2)}
    </span>
  );
}

function BearCaseScenario({
  baseBear, price, fair, beta, troughPe, troughPs, eps, epsLabel,
  evEbitda, psRatio, fcfConversionPct, week52High, week52Low, sector,
}: {
  baseBear: number; price: number; fair: number;
  beta: number; troughPe: number; troughPs: number; eps: string; epsLabel: string;
  evEbitda: number | null; psRatio: number | null; fcfConversionPct: number | null;
  week52High: number | null; week52Low: number | null; sector: string;
}) {
  const [cpi, setCpi]             = useState(3.0);
  const [rateInc, setRateInc]     = useState(0.0);
  const [indexDrop, setIndexDrop] = useState(0.0);

  // Macro compression factors (shared across both metrics)
  const inflationFactor = 1 - Math.max(0, cpi - 2) * 0.05;
  const rateFactor      = 1 - rateInc * 0.12;
  const macroFactor     = inflationFactor * rateFactor;
  const betaDrop        = beta * (indexDrop / 100);

  // ── FCF quality discount on EPS ───────────────────────────────────────
  // Poor FCF conversion = low earnings quality = market applies harsher discount in bear markets
  const fcfQualityFactor =
    fcfConversionPct == null ? 1.0 :
    fcfConversionPct >= 90  ? 1.0  :
    fcfConversionPct >= 70  ? 0.85 :
    fcfConversionPct >= 50  ? 0.70 :
                              0.55;
  const fcfQualityLabel =
    fcfConversionPct == null ? null :
    fcfConversionPct >= 90  ? null          :   // no label if no discount applied
    fcfConversionPct >= 70  ? "−15% quality discount" :
    fcfConversionPct >= 50  ? "−30% quality discount" :
                              "−45% quality discount";
  const qualityEps  = parseFloat(eps) * fcfQualityFactor;

  // ── Metric 1: Trough P/E ──────────────────────────────────────────────
  const adjPe       = Math.max(4, troughPe * macroFactor);
  const adjBearPe   = adjPe * qualityEps;
  const scenarioPe  = Math.max(0.01, adjBearPe * (1 - betaDrop));

  // ── Metric 2: Trough EV/EBITDA, falling back to P/S ─────────────────
  const benchmark  = SECTOR_EVEB[sector] ?? DEFAULT_EVEB;
  const troughEvEb = benchmark ? benchmark.cheap : null;
  const adjEvEb    = troughEvEb != null ? Math.max(3, troughEvEb * macroFactor) : null;

  const useEvEb    = adjEvEb != null && evEbitda != null && evEbitda > 0;
  const usePs      = !useEvEb && psRatio != null && psRatio > 0;

  const adjPs      = usePs ? Math.max(0.1, troughPs * macroFactor) : null;

  // Bear price — prefer EV/EBITDA, fall back to P/S
  const scenarioEvEb = useEvEb
    ? Math.max(0.01, (adjEvEb! / evEbitda!) * price * (1 - betaDrop))
    : usePs
    ? Math.max(0.01, (adjPs! / psRatio!) * price * (1 - betaDrop))
    : null;

  const metric2Label    = useEvEb ? "EV/EBITDA" : "Price/Sales";
  const metric2Trough   = useEvEb ? adjEvEb! : adjPs;
  const metric2Current  = useEvEb ? evEbitda! : psRatio;
  const metric2BaseTrough = useEvEb ? troughEvEb! : troughPs;
  const metric2Compression = metric2BaseTrough && metric2Trough
    ? ((1 - metric2Trough / metric2BaseTrough) * 100).toFixed(0)
    : null;

  // ── Sentiment floor: 52W Low ─────────────────────────────────────────
  // The 52W low is what the market has actually demonstrated as a floor — real sentiment data
  // Beta-adjusted: if SPY drops further, apply same beta factor
  const sentimentFloor = week52Low != null
    ? Math.max(0.01, week52Low * (1 - betaDrop))
    : null;

  // Reality check: if model bear > 52W high, the model is detached from trading reality
  const modelAbove52WHigh = week52High != null && scenarioPe > week52High;

  // Worst-case floor = lowest of model P/E, model EV or P/S, and sentiment (52W low)
  const candidates52 = [scenarioPe, scenarioEvEb, sentimentFloor].filter((v): v is number => v != null);
  const worstCase    = candidates52.length > 0 ? Math.min(...candidates52) : scenarioPe;

  // Range bar anchors — include 52W high as upper context
  const rangeMax = Math.max(price, fair, scenarioPe, scenarioEvEb ?? 0, week52High ?? 0) * 1.1 || 1;
  const pePct    = Math.min((scenarioPe          / rangeMax) * 100, 100);
  const evPct    = scenarioEvEb != null   ? Math.min((scenarioEvEb   / rangeMax) * 100, 100) : null;
  const sentPct  = sentimentFloor != null ? Math.min((sentimentFloor / rangeMax) * 100, 100) : null;
  const curPct   = Math.min((price               / rangeMax) * 100, 100);
  const fairPct  = Math.min((fair                / rangeMax) * 100, 100);
  const high52Pct = week52High != null    ? Math.min((week52High      / rangeMax) * 100, 100) : null;

  const peCompression   = ((1 - adjPe / troughPe) * 100).toFixed(0);

  return (
    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
        Bear Case Scenario
      </p>

      {/* ── Two metric cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

        {/* Metric 1 — Trough P/E */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-3">
          <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Trough P/E
          </p>
          {/* Formula */}
          <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5 mb-2">
            <p>Trough P/E × {epsLabel}{fcfQualityFactor < 1 ? " × FCF quality" : ""}</p>
            <p className="text-zinc-400">
              {adjPe.toFixed(1)}× × ${parseFloat(eps).toFixed(2)}
              {fcfQualityFactor < 1 && <span className="text-orange-400"> × {fcfQualityFactor.toFixed(2)}</span>}
            </p>
            {betaDrop > 0 && (
              <p className="text-zinc-400">× (1 − β{beta.toFixed(2)} × {indexDrop}%)</p>
            )}
            <p className="border-t border-zinc-200 dark:border-zinc-600 pt-0.5 mt-1 text-zinc-700 dark:text-zinc-200 font-semibold">
              = ${fmt(scenarioPe)}
            </p>
          </div>
          <PctVsCurrent bear={scenarioPe} current={price} />
          {fcfQualityLabel && (
            <p className="text-[9px] text-orange-500 dark:text-orange-400 mt-1 font-semibold">
              ⚠ FCF conversion {fcfConversionPct?.toFixed(0)}% · {fcfQualityLabel}
            </p>
          )}
          <p className="text-[9px] text-zinc-400 mt-0.5">
            Base {troughPe}× → {adjPe.toFixed(1)}× after −{peCompression}% macro compression
          </p>
        </div>

        {/* Metric 2 — EV/EBITDA or P/S fallback */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-3">
          <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Trough {metric2Label}
            {usePs && <span className="ml-1 text-[9px] font-normal text-zinc-400">(EV/EBITDA unavailable)</span>}
          </p>
          {scenarioEvEb != null && metric2Trough != null && metric2Current != null ? (
            <>
              <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5 mb-2">
                <p>(Trough ÷ Current {metric2Label}) × Price</p>
                <p className="text-zinc-400">({metric2Trough.toFixed(1)}× ÷ {metric2Current.toFixed(1)}×) × ${price.toFixed(2)}</p>
                {betaDrop > 0 && (
                  <p className="text-zinc-400">× (1 − β{beta.toFixed(2)} × {indexDrop}%)</p>
                )}
                <p className="border-t border-zinc-200 dark:border-zinc-600 pt-0.5 mt-1 text-zinc-700 dark:text-zinc-200 font-semibold">
                  = ${fmt(scenarioEvEb)}
                </p>
              </div>
              <PctVsCurrent bear={scenarioEvEb} current={price} />
              {metric2Compression && (
                <p className="text-[9px] text-zinc-400 mt-1">
                  Base {metric2BaseTrough}× → {metric2Trough.toFixed(1)}× after −{metric2Compression}% macro compression
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-zinc-400">
              Neither EV/EBITDA nor P/S available for this stock.
            </p>
          )}
        </div>
      </div>

      {/* 52W Sentiment card — inline with metric cards */}
      {(week52High != null || week52Low != null) && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-3 mb-3">
          <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
            Market Sentiment (52W Range)
          </p>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] text-zinc-400">52W Low — demonstrated floor</p>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {week52Low != null ? `$${week52Low.toFixed(2)}` : "—"}
              </p>
              {sentimentFloor != null && sentimentFloor !== week52Low && (
                <p className="text-[9px] text-zinc-400">β-adj: ${sentimentFloor.toFixed(2)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-400">52W High — recent ceiling</p>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {week52High != null ? `$${week52High.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
          {/* Sentiment range bar */}
          {week52Low != null && week52High != null && week52High > week52Low && (() => {
            const span   = week52High - week52Low;
            const curPos = Math.min(Math.max(((price - week52Low) / span) * 100, 0), 100);
            return (
              <div>
                <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-1">
                  <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-400 via-amber-300 to-emerald-400 rounded-full w-full opacity-40" />
                  <div
                    className="absolute top-[-3px] bottom-[-3px] w-1.5 rounded-sm bg-indigo-500"
                    style={{ left: `${curPos}%`, transform: "translateX(-50%)" }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>52W Low ${week52Low.toFixed(0)}</span>
                  <span className="font-medium">Current ${price.toFixed(2)} · {curPos.toFixed(0)}% of range</span>
                  <span>52W High ${week52High.toFixed(0)}</span>
                </div>
              </div>
            );
          })()}
          {modelAbove52WHigh && (
            <p className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-2">
              ⚠ Model bear (${scenarioPe.toFixed(2)}) exceeds 52W high — stock has never traded there. Likely driven by one-time EPS. Use 52W Low as floor.
            </p>
          )}
        </div>
      )}

      {/* Worst-case callout */}
      <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 mb-4">
        <div>
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Worst-case floor</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            {sentimentFloor != null ? "Lowest of P/E model, EV/P/S model, and 52W low" : "Lower of both model metrics under current scenario"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-red-500">${fmt(worstCase)}</p>
          <PctVsCurrent bear={worstCase} current={price} />
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Inflation (CPI)</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{cpi.toFixed(1)}%</span>
          </div>
          <input type="range" min={2} max={9} step={0.5} value={cpi}
            onChange={(e) => setCpi(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full accent-amber-500 cursor-pointer" />
          <div className="flex justify-between text-[9px] text-zinc-400 mt-0.5">
            <span>2% target</span><span>9% severe</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Rate Increase (10Y yield)</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">+{rateInc.toFixed(2)}%</span>
          </div>
          <input type="range" min={0} max={3} step={0.25} value={rateInc}
            onChange={(e) => setRateInc(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full accent-orange-500 cursor-pointer" />
          <div className="flex justify-between text-[9px] text-zinc-400 mt-0.5">
            <span>No change</span><span>+3% (severe tightening)</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Index Drop (SPY)</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">−{indexDrop.toFixed(0)}%</span>
          </div>
          <input type="range" min={0} max={40} step={1} value={indexDrop}
            onChange={(e) => setIndexDrop(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full accent-red-500 cursor-pointer" />
          <div className="flex justify-between text-[9px] text-zinc-400 mt-0.5">
            <span>No drop</span><span>−40% (crash)</span>
          </div>
        </div>
      </div>

      {/* Range bar */}
      {price > 0 && (
        <>
          <div className="relative h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-visible mb-3">
            {/* 52W High — upper context */}
            {high52Pct != null && (
              <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-emerald-400 rounded-full opacity-60" style={{ left: `${high52Pct}%` }} />
            )}
            {/* Sentiment floor (52W Low) */}
            {sentPct != null && (
              <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-purple-400 rounded-full" style={{ left: `${sentPct}%` }} />
            )}
            {/* P/E bear marker */}
            <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-red-400 rounded-full" style={{ left: `${pePct}%` }} />
            {/* EV/P/S bear marker */}
            {evPct != null && (
              <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-orange-400 rounded-full" style={{ left: `${evPct}%` }} />
            )}
            {/* Graham marker */}
            {fair > 0 && (
              <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-zinc-400 dark:bg-zinc-500 rounded-full" style={{ left: `${fairPct}%` }} />
            )}
            {/* Current price */}
            <div className="absolute top-[-4px] bottom-[-4px] w-1.5 rounded-sm bg-indigo-500"
              style={{ left: `${curPct}%`, transform: "translateX(-50%)" }} />
          </div>

          {/* Legend — build columns dynamically */}
          {(() => {
            const cols = [
              { color: "bg-red-400", label: "P/E floor", value: `$${scenarioPe.toFixed(2)}`, cls: "text-red-400" },
              ...(evPct != null && scenarioEvEb != null ? [{ color: "bg-orange-400", label: metric2Label, value: `$${scenarioEvEb.toFixed(2)}`, cls: "text-orange-400" }] : []),
              ...(sentPct != null && sentimentFloor != null ? [{ color: "bg-purple-400", label: "52W Low", value: `$${sentimentFloor.toFixed(2)}`, cls: "text-purple-400" }] : []),
              { color: "bg-indigo-500", label: "Current", value: `$${price.toFixed(2)}`, cls: "text-indigo-500" },
              ...(fair > 0 ? [{ color: "bg-zinc-400", label: "Graham", value: `$${fair.toFixed(2)}`, cls: "text-zinc-500 dark:text-zinc-400" }] : []),
              ...(high52Pct != null && week52High != null ? [{ color: "bg-emerald-400", label: "52W High", value: `$${week52High.toFixed(2)}`, cls: "text-emerald-500 opacity-70" }] : []),
            ];
            return (
              <div className={`grid text-[10px] gap-x-2 gap-y-1`} style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
                {cols.map((c) => (
                  <div key={c.label}>
                    <span className="flex items-center gap-1 text-zinc-400 mb-0.5">
                      <span className={`inline-block w-2 h-0.5 ${c.color} rounded-full shrink-0`} />
                      {c.label}
                    </span>
                    <p className={`font-semibold ${c.cls}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      <p className="text-[10px] text-zinc-400 mt-3 leading-relaxed">
        Beta {beta.toFixed(2)} — this stock moves ~{beta.toFixed(2)}× the index.
        {indexDrop > 0 ? ` A ${indexDrop}% SPY drop implies an additional −${(betaDrop * 100).toFixed(1)}% on this stock.` : ""}
      </p>
    </div>
  );
}

export default function IntrinsicValue({ price, fairValue, formula, note, netCashPerShare, evEbitda, fcfYield, sector, bearCase }: Props) {
  const hasAny = price || fairValue;
  if (!hasAny) return null;

  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc   = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const L     = 40;   // left margin
      const R     = 555;  // right edge
      const W     = R - L;
      let   y     = 40;

      const priceN  = parseNum(price);
      const fairN   = parseNum(fairValue);
      const mosRawN = fairN && priceN ? ((fairN - priceN) / fairN) * 100 : null;

      // ── helpers ──────────────────────────────────────────────────────
      const nl = (n = 8) => { y += n; };
      const rule = (color = "#e4e4e7") => {
        doc.setDrawColor(color); doc.setLineWidth(0.5);
        doc.line(L, y, R, y); nl(10);
      };
      const label = (text: string, color = "#71717a") => {
        doc.setFontSize(7); doc.setTextColor(color);
        doc.setFont("helvetica", "bold");
        doc.text(text.toUpperCase(), L, y); nl(11);
      };
      const body = (text: string, color = "#3f3f46") => {
        doc.setFontSize(9); doc.setTextColor(color);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, W);
        doc.text(lines, L, y); nl(lines.length * 12);
      };
      const mono = (text: string, color = "#52525b") => {
        doc.setFontSize(8.5); doc.setTextColor(color);
        doc.setFont("courier", "normal");
        doc.text(text, L, y); nl(11);
      };
      const row2 = (left: string, right: string, boldRight = false) => {
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor("#3f3f46");
        doc.text(left, L, y);
        doc.setFont("helvetica", boldRight ? "bold" : "normal");
        doc.text(right, R, y, { align: "right" }); nl(13);
      };
      const bigNum = (text: string, color = "#18181b") => {
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(color);
        doc.text(text, L, y); nl(22);
      };

      // ── Header ───────────────────────────────────────────────────────
      doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor("#18181b");
      doc.text("Intrinsic Value Report", L, y); nl(8);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor("#a1a1aa");
      doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, L, y);
      if (formula) { doc.text(formula, R, y, { align: "right" }); }
      nl(16); rule();

      // ── Graham Number ────────────────────────────────────────────────
      label("Graham Number (Intrinsic Value)");
      const cols = [
        { t: "Stock Price",       v: priceN   ? `$${priceN.toFixed(2)}`   : "—" },
        { t: "Graham Number",     v: fairN    ? `$${fairN.toFixed(2)}`    : "—" },
        { t: "Margin of Safety",  v: mosRawN  != null ? `${mosRawN >= 0 ? "+" : ""}${mosRawN.toFixed(1)}%` : "—" },
      ];
      const colW = W / cols.length;
      cols.forEach((c, i) => {
        const cx = L + i * colW;
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor("#a1a1aa");
        doc.text(c.t, cx, y);
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.setTextColor(
          c.t === "Margin of Safety"
            ? (mosRawN != null && mosRawN > 0 ? "#16a34a" : "#ef4444")
            : "#18181b"
        );
        doc.text(c.v, cx, y + 14);
      });
      nl(32); rule();

      // ── Bear Case ────────────────────────────────────────────────────
      if (bearCase) {
        const bc     = bearCase;
        const bcNum  = parseNum(bc.price);
        const pct    = priceN > 0 ? ((bcNum - priceN) / priceN * 100) : null;

        label("Bear Case Scenario");
        row2("Method:", bc.method);
        row2("Trough P/E:", `${bc.troughPe}×`);
        row2(`${bc.epsLabel}:`, `$${bc.eps}`);
        if (bc.fcfConversionPct != null && bc.fcfConversionPct < 90) {
          row2("FCF Conversion:", `${bc.fcfConversionPct.toFixed(0)}% — quality discount applied`);
        }
        nl(2);
        label("Base Bear Price (P/E)");
        bigNum(`$${bcNum.toFixed(2)}`, bcNum < priceN ? "#ef4444" : "#16a34a");
        if (pct !== null) {
          doc.setFontSize(9); doc.setFont("helvetica", "normal");
          doc.setTextColor(pct >= 0 ? "#16a34a" : "#ef4444");
          doc.text(`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs current price`, L, y); nl(14);
        }

        if (bc.week52High != null || bc.week52Low != null) {
          nl(4); rule("#f4f4f5");
          label("Market Sentiment (52W Range)");
          if (bc.week52Low  != null) row2("52W Low (demonstrated floor):", `$${bc.week52Low.toFixed(2)}`);
          if (bc.week52High != null) row2("52W High (recent ceiling):",    `$${bc.week52High.toFixed(2)}`);
          if (bc.week52High != null && bcNum > bc.week52High) {
            nl(2);
            doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor("#d97706");
            doc.text("⚠ Bear model exceeds 52W high — EPS may include one-time items. Use 52W Low as floor.", L, y); nl(12);
          }
        }

        nl(4); rule("#f4f4f5");
        label("Formula (Trough P/E)");
        mono(`${bc.troughPe}× trough P/E  ×  $${bc.eps} ${bc.epsLabel}${bc.fcfConversionPct != null && bc.fcfConversionPct < 90 ? `  ×  FCF quality factor` : ""}`);
        mono(`= $${bcNum.toFixed(2)}`);
        nl(4); rule();
      }

      // ── EV/EBITDA + FCF Yield ────────────────────────────────────────
      const evN = evEbitda ? parseNum(evEbitda) : null;
      if (evN || fcfYield != null) {
        label("Valuation Multiples");
        if (evN) row2("EV / EBITDA:", `${evN.toFixed(1)}×`);
        if (fcfYield != null) row2("FCF Yield:", `${fcfYield.toFixed(1)}%`);
        nl(4); rule();
      }

      // ── Net Cash ─────────────────────────────────────────────────────
      if (netCashPerShare) {
        const nc = parseNum(netCashPerShare);
        label("Net Cash / Share");
        bigNum(`${nc >= 0 ? "$" : "−$"}${Math.abs(nc).toFixed(2)}`, nc > 0 ? "#16a34a" : "#ef4444");
        body(nc > priceN ? "Trading below net cash — potential Graham net-net opportunity." : nc >= 0 ? "Cash exceeds debt — self-funding balance sheet." : "Net debt position.");
        nl(4); rule();
      }

      // ── Footer ───────────────────────────────────────────────────────
      doc.setFontSize(7); doc.setTextColor("#a1a1aa"); doc.setFont("helvetica", "normal");
      doc.text("For informational purposes only. Not financial advice. Bear case uses sector trough P/E × conservative EPS.", L, y);

      doc.save(`valuation-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const priceNum = parseNum(price);
  const fair = parseNum(fairValue);
  const mosRaw = fair && priceNum ? ((fair - priceNum) / fair) * 100 : null;

  const isUndervalued = mosRaw !== null && mosRaw > 0;
  const isOvervalued = mosRaw !== null && mosRaw < 0;

  const mosColor = isUndervalued
    ? "text-emerald-600 dark:text-emerald-400"
    : isOvervalued
    ? "text-red-500 dark:text-red-400"
    : "text-zinc-500";

  const badgeBg = isUndervalued
    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
    : isOvervalued
    ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
    : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700";

  let barPercent: number | null = null;
  if (priceNum && fair) {
    barPercent = Math.min(Math.max((priceNum / fair) * 100, 0), 200);
  }

  return (
    <div className={`rounded-xl border p-5 ${badgeBg}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Intrinsic Value</h3>
          {formula && <p className="text-xs text-zinc-400 mt-0.5">{formula}</p>}
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 shrink-0"
        >
          {exporting ? (
            <span className="inline-block w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 13.5A.5.5 0 0 1 3 13h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zM7.646 10.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 9.293V1.5a.5.5 0 0 0-1 0v7.793L5.354 7.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
          )}
          {exporting ? "Exporting…" : "Export PDF"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Stock Price</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {priceNum ? `$${fmt(priceNum)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Graham Number</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {fairValue ? `$${fmt(parseNum(fairValue))}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Margin of Safety</p>
          <p className={`text-xl font-bold ${mosColor}`}>
            {mosRaw !== null
              ? `${mosRaw >= 0 ? "+" : ""}${mosRaw.toFixed(1)}%`
              : "—"}
          </p>
        </div>
      </div>

      {note && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 pb-2">{note}</p>
      )}

      {/* Bear Case */}
      {bearCase && (() => {
        const baseBearNum  = parseNum(bearCase.price);
        const beta         = bearCase.beta ?? 1.0;
        const evEbitdaNum  = evEbitda ? parseNum(evEbitda) : null;
        const psNum        = bearCase.psRatio ? parseNum(bearCase.psRatio) : null;
        return <BearCaseScenario
          baseBear={baseBearNum}
          price={priceNum}
          fair={fair}
          beta={beta}
          troughPe={bearCase.troughPe}
          troughPs={bearCase.troughPs}
          eps={bearCase.eps}
          epsLabel={bearCase.epsLabel}
          evEbitda={evEbitdaNum}
          psRatio={psNum}
          fcfConversionPct={bearCase.fcfConversionPct}
          week52High={bearCase.week52High}
          week52Low={bearCase.week52Low}
          sector={sector ?? ""}
        />;
      })()}

      {barPercent !== null && (
        <div className={bearCase ? "mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700" : ""}>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>$0</span>
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              Graham Number {fair ? `$${fmt(fair)}` : ""}
            </span>
          </div>
          <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-zinc-400 dark:bg-zinc-500 z-10" />
            <div
              className={`absolute top-0 bottom-0 left-0 rounded-full transition-all ${
                isUndervalued ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(barPercent / 2, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>{isUndervalued ? "Undervalued" : isOvervalued ? "Overvalued" : ""}</span>
            <span>{priceNum ? `Current $${priceNum.toFixed(2)}` : ""}</span>
          </div>
        </div>
      )}

      {/* ── EV/EBITDA + FCF Yield ── */}
      {(evEbitda || fcfYield != null) && (() => {
        const evN = evEbitda ? parseNum(evEbitda) : null;
        const benchmark = sector
          ? (SECTOR_EVEB[sector] !== undefined ? SECTOR_EVEB[sector] : DEFAULT_EVEB)
          : DEFAULT_EVEB;
        const isFinancial = benchmark === null;

        let evColor = "text-zinc-500 dark:text-zinc-400";
        let evLabel = "";
        if (!isFinancial && evN && evN > 0 && benchmark) {
          if (evN <= benchmark.cheap)      { evColor = "text-emerald-600 dark:text-emerald-400"; evLabel = "Cheap"; }
          else if (evN <= benchmark.fair)  { evColor = "text-amber-600 dark:text-amber-400";     evLabel = "Fair";  }
          else                             { evColor = "text-red-500 dark:text-red-400";          evLabel = "Expensive"; }
        }

        const fcfColor = fcfYield == null ? "text-zinc-400"
          : fcfYield >= 7 ? "text-emerald-600 dark:text-emerald-400"
          : fcfYield >= 4 ? "text-amber-600 dark:text-amber-400"
          : fcfYield >= 2 ? "text-zinc-500 dark:text-zinc-400"
          : "text-red-500 dark:text-red-400";
        const fcfLabel = fcfYield == null ? ""
          : fcfYield >= 7 ? "Excellent"
          : fcfYield >= 4 ? "Good"
          : fcfYield >= 2 ? "Fair"
          : "Weak";

        return (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 grid grid-cols-2 gap-4">
            {/* EV/EBITDA */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
                EV / EBITDA
              </p>
              {isFinancial ? (
                <p className="text-sm text-zinc-400">N/A for financials</p>
              ) : evN && evN > 0 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-2xl font-bold ${evColor}`}>{evN.toFixed(1)}x</p>
                    {evLabel && (
                      <span className={`text-xs font-semibold ${evColor}`}>{evLabel}</span>
                    )}
                  </div>
                  {benchmark && (
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {sector ?? "Market"} benchmarks · &lt;{benchmark.cheap}x cheap · &lt;{benchmark.fair}x fair
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-zinc-400">—</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Not reported — likely negative or near-zero EBITDA</p>
                </>
              )}
            </div>
            {/* FCF Yield */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1">
                FCF Yield
              </p>
              {fcfYield != null && fcfYield > 0 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-2xl font-bold ${fcfColor}`}>{fcfYield.toFixed(1)}%</p>
                    {fcfLabel && (
                      <span className={`text-xs font-semibold ${fcfColor}`}>{fcfLabel}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    &gt;7% excellent · &gt;4% good · &gt;2% fair
                  </p>
                </>
              ) : (
                <p className="text-xl font-bold text-zinc-400">—</p>
              )}
            </div>
          </div>
        );
      })()}

      {netCashPerShare && (() => {
        const nc = parseNum(netCashPerShare);
        const isNetNet = priceNum > 0 && nc > 0 && priceNum < nc;
        const isPositive = nc > 0;
        // bar: show price relative to nc (anchored at 0)
        const maxVal = Math.max(Math.abs(nc) * 1.5, priceNum * 1.2, 1);
        const ncBarPct  = Math.min(Math.max((nc / maxVal) * 100, 0), 100);
        const priceBarPct = Math.min(Math.max((priceNum / maxVal) * 100, 0), 100);

        const containerCls = isNetNet
          ? "mt-4 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 p-3"
          : isPositive
          ? "mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-3"
          : "mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-3";

        const valueCls = isNetNet
          ? "text-2xl font-bold text-emerald-600 dark:text-emerald-400"
          : isPositive
          ? "text-2xl font-bold text-zinc-900 dark:text-zinc-50"
          : "text-2xl font-bold text-red-500 dark:text-red-400";

        const label = isNetNet
          ? "Stock trades below net cash — rare Graham net-net opportunity"
          : isPositive
          ? "Cash surplus after all debt — balance sheet is self-funding"
          : "Debt exceeds cash — net cash position is negative";

        return (
          <div className={containerCls}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                Net Cash / Share
              </p>
              {isNetNet && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">
                  NET-NET
                </span>
              )}
            </div>
            <div className="flex items-end gap-3 mt-0.5 mb-1">
              <p className={valueCls}>
                {nc >= 0 ? "$" : "−$"}{fmt(Math.abs(nc))}
              </p>
              {priceNum > 0 && (() => {
                const ncPct = (nc / priceNum) * 100;
                const tier =
                  ncPct >= 100 ? { label: "Net-Net",        cls: "bg-emerald-500 text-white" } :
                  ncPct >= 30  ? { label: "Strong cushion",  cls: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" } :
                  ncPct >= 0   ? { label: "Healthy surplus", cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" } :
                  ncPct >= -30 ? { label: "Modest net debt", cls: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" } :
                                 { label: "High net debt",   cls: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" };
                return (
                  <span className={`mb-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${tier.cls}`}>
                    {tier.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{label}</p>
            {/* Price vs Net Cash bar */}
            <div className="relative mb-1" style={{ paddingTop: "18px" }}>
              {/* Stock price label above the line */}
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${priceBarPct}%` }}
              >
                <span className={`text-[10px] font-semibold whitespace-nowrap ${isNetNet ? "text-emerald-700 dark:text-emerald-300" : isPositive ? "text-indigo-500 dark:text-indigo-400" : "text-red-500"}`}>
                  Stock Price
                </span>
              </div>
              <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                {isPositive && (
                  <div
                    className={`absolute top-0 bottom-0 left-0 rounded-full ${isNetNet ? "bg-emerald-400" : "bg-zinc-400 dark:bg-zinc-500"}`}
                    style={{ width: `${ncBarPct}%` }}
                  />
                )}
                <div
                  className={`absolute top-0 bottom-0 w-1 -translate-x-1/2 ${isNetNet ? "bg-emerald-700 dark:bg-emerald-300" : isPositive ? "bg-indigo-500" : "bg-red-500"}`}
                  style={{ left: `${priceBarPct}%` }}
                />
              </div>
            </div>
            {/* Benchmark scale */}
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/60">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Benchmark · Net Cash as % of Price</p>
              <div className="flex items-center gap-0 rounded-full overflow-hidden h-1.5 mb-1.5">
                <div className="flex-1 bg-red-400" />
                <div className="flex-1 bg-amber-300" />
                <div className="flex-1 bg-zinc-300 dark:bg-zinc-600" />
                <div className="flex-1 bg-emerald-300" />
                <div className="flex-1 bg-emerald-500" />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>High debt</span>
                <span>Modest debt</span>
                <span className="font-medium text-zinc-500 dark:text-zinc-400">0%</span>
                <span>&gt;30% Strong</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">&gt;100% Net-Net</span>
              </div>
              {priceNum > 0 && (
                <p className={`text-[10px] mt-1.5 font-semibold ${
                  nc / priceNum >= 1    ? "text-emerald-600 dark:text-emerald-400" :
                  nc / priceNum >= 0.3  ? "text-emerald-500" :
                  nc / priceNum >= 0    ? "text-zinc-500 dark:text-zinc-400" :
                  nc / priceNum >= -0.3 ? "text-amber-600 dark:text-amber-400" :
                                          "text-red-500"
                }`}>
                  {((nc / priceNum) * 100).toFixed(1)}% of stock price
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Methodology ── */}
      <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
          How These Numbers Are Calculated
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Graham Number</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              Formula: <span className="font-mono">√(22.5 × EPS × Book Value/Share)</span>. Developed by Benjamin Graham — the "father of value investing." It combines a stock's earnings power (P/E ≤ 15) and asset value (P/B ≤ 1.5) into a single fair-price ceiling. A stock below this number is considered conservatively undervalued. Works best for profitable, asset-heavy companies; less useful for high-growth or asset-light businesses.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Bear Case Price</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              Formula: <span className="font-mono">Trough Sector P/E × Conservative EPS</span>. Estimates where a stock could realistically trade if sentiment collapses — not if the business fails, but if investors price it at the lowest multiple seen historically in its sector (e.g. 8× for Energy, 15× for Technology). EPS used is the lower of trailing twelve months or next-year analyst estimate, to avoid distortion from one-time charges or windfalls. If the current price is already below this floor, EPS quality should be verified.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Margin of Safety</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              <span className="font-mono">(Graham Number − Current Price) / Graham Number</span>. Positive = stock is below Graham's fair value ceiling (potential upside to fair value). Negative = stock is above it (trading at a premium to conservative value). Graham himself recommended a 33%+ margin of safety before buying.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Net Cash / Share</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              <span className="font-mono">Cash &amp; Equivalents − Total Debt</span>, divided by shares outstanding. Positive means the company holds more cash than debt — a balance sheet buffer. If net cash exceeds the stock price (a "net-net"), the market is valuing the operating business at zero or less, which Graham considered a rare deep-value signal.
            </p>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed pt-1 border-t border-zinc-100 dark:border-zinc-800">
            These are conservative screening tools, not price targets. They work best in combination — a stock scoring well on Graham Number, with a bear floor well below current price and positive net cash, presents a strong margin of safety. Always verify EPS quality and business fundamentals before acting.
          </p>
        </div>
      </div>
    </div>
  );
}
