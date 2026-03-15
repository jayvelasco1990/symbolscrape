"use client";

import { useState } from "react";

/**
 * Diversification Score
 *
 * Formula: Herfindahl-Hirschman Index (HHI)
 *   HHI  = Σ wᵢ²           (sum of squared portfolio weights, 0–1 scale)
 *   ENP  = 1 / HHI          (Effective Number of Positions)
 *   Score = min(ENP / 20, 1) × 100
 *     — 20 equal-weight positions → ENP = 20 → Score = 100
 *     — 1 position               → ENP =  1 → Score =   5
 *
 * Falls back to equal-weighting if no quantities are set.
 */

interface Item {
  ticker: string;
  price: string;
  quantity: number;
}

function calcDiversification(items: Item[]) {
  if (items.length === 0) return null;

  const values = items.map((i) => (parseFloat(i.price) || 0) * (i.quantity || 0));
  const totalValue = values.reduce((s, v) => s + v, 0);

  // Fall back to equal weight if no quantities/prices set
  const weights =
    totalValue > 0
      ? values.map((v) => v / totalValue)
      : items.map(() => 1 / items.length);

  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const enp = 1 / hhi;
  const score = Math.min((enp / 20) * 100, 100);

  const sorted = weights
    .map((w, i) => ({ ticker: items[i].ticker, weight: w }))
    .sort((a, b) => b.weight - a.weight);

  const top1Pct = sorted[0]?.weight * 100 ?? 0;
  const top3Pct = sorted.slice(0, 3).reduce((s, x) => s + x.weight * 100, 0);
  const isEqualWeighted = totalValue === 0;

  return { score, hhi, enp, top1Pct, top3Pct, top: sorted.slice(0, 3), isEqualWeighted };
}

function verdict(score: number): { label: string; color: string; ring: string; bar: string; desc: string } {
  if (score >= 75)
    return {
      label: "Well Diversified",
      color: "text-emerald-700 dark:text-emerald-400",
      ring: "border-emerald-300 dark:border-emerald-700",
      bar: "bg-emerald-500",
      desc: "Good spread across positions. Low single-stock risk.",
    };
  if (score >= 50)
    return {
      label: "Moderately Diversified",
      color: "text-teal-700 dark:text-teal-400",
      ring: "border-teal-300 dark:border-teal-700",
      bar: "bg-teal-500",
      desc: "Reasonable spread, but a few positions carry significant weight.",
    };
  if (score >= 25)
    return {
      label: "Concentrated",
      color: "text-amber-700 dark:text-amber-400",
      ring: "border-amber-300 dark:border-amber-700",
      bar: "bg-amber-400",
      desc: "Portfolio is concentrated. A single stock move can materially affect returns.",
    };
  return {
    label: "Highly Concentrated",
    color: "text-red-600 dark:text-red-400",
    ring: "border-red-300 dark:border-red-700",
    bar: "bg-red-500",
    desc: "Very high single-stock risk. Consider adding more positions.",
  };
}

export default function DiversificationScore({ items }: { items: Item[] }) {
  const result = calcDiversification(items);
  const [open, setOpen] = useState(false);
  if (!result) return null;

  const { score, hhi, enp, top1Pct, top3Pct, top, isEqualWeighted } = result;
  const v = verdict(score);

  return (
    <div className={`rounded-xl border ${v.ring} bg-white dark:bg-black px-6 py-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-1">
            Diversification Score
          </p>

          {/* Score + verdict */}
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              {score.toFixed(0)}
            </span>
            <span className="text-sm text-zinc-400">/ 100</span>
            <span className={`text-sm font-semibold ${v.color}`}>{v.label}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${v.bar}`}
              style={{ width: `${score}%` }}
            />
          </div>

          <p className="text-xs text-zinc-400 mb-4">{v.desc}</p>

          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-3">
            <Metric label="HHI" value={hhi.toFixed(3)} hint="Lower = more diversified" />
            <Metric label="Eff. Positions" value={enp.toFixed(1)} hint="Equivalent equal-weight holdings" />
            <Metric label="Top Holding" value={`${top1Pct.toFixed(1)}%`} hint={top[0]?.ticker ?? ""} />
            <Metric label="Top 3 Holdings" value={`${top3Pct.toFixed(1)}%`} hint={top.map((t) => t.ticker).join(", ")} />
          </div>
        </div>
      </div>

      {/* Formula explanation — collapsible */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <span>{open ? "▾" : "▸"}</span>
          How this is calculated
        </button>

        {open && (
          <div className="mt-3 flex flex-col gap-4 text-xs text-zinc-500 dark:text-zinc-400">

            <div>
              <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Step 1 — Position weights (wᵢ)</p>
              <p>Each stock&apos;s weight is its share of total portfolio value:</p>
              <code className="block mt-1 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 font-mono text-zinc-600 dark:text-zinc-300">
                wᵢ = (price × quantity) / total portfolio value
              </code>
              <p className="mt-1 text-zinc-400">
                {isEqualWeighted
                  ? "⚠ No quantities set — falling back to equal weights (1 / n)."
                  : "All weights sum to 1 (100%)."}
              </p>
            </div>

            <div>
              <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Step 2 — HHI (Herfindahl-Hirschman Index)</p>
              <p>Measures concentration by squaring and summing all weights. Squaring penalises large positions disproportionately.</p>
              <code className="block mt-1 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 font-mono text-zinc-600 dark:text-zinc-300">
                HHI = Σ wᵢ²
              </code>
              <p className="mt-1 text-zinc-400">
                Range: {items.length > 0 ? `1/${items.length} (${(1/items.length).toFixed(3)})` : "1/n"} for perfectly equal weights → 1.0 for a single position.
                Lower HHI = more diversified. Current: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{hhi.toFixed(3)}</span>.
              </p>
            </div>

            <div>
              <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Step 3 — ENP (Effective Number of Positions)</p>
              <p>Translates HHI into an intuitive count: how many equal-weight positions would produce the same HHI.</p>
              <code className="block mt-1 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 font-mono text-zinc-600 dark:text-zinc-300">
                ENP = 1 / HHI
              </code>
              <p className="mt-1 text-zinc-400">
                Even with {items.length} holdings, concentration reduces the effective count.
                Current ENP: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{enp.toFixed(1)}</span> out of {items.length} actual positions.
              </p>
            </div>

            <div>
              <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Step 4 — Score (0–100)</p>
              <p>Normalises ENP against a target of 20 well-spread positions, which academic research associates with substantially reduced unsystematic risk.</p>
              <code className="block mt-1 px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-900 font-mono text-zinc-600 dark:text-zinc-300">
                Score = min(ENP / 20, 1) × 100
              </code>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-zinc-400">
                <span>≥ 75 — Well Diversified</span>
                <span>≥ 50 — Moderately Diversified</span>
                <span>≥ 25 — Concentrated</span>
                <span>&lt; 25 — Highly Concentrated</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint} className="cursor-default">
      <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-zinc-400 truncate">{hint}</p>}
    </div>
  );
}
