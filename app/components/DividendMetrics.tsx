type Sustainability = "healthy" | "moderate" | "risk" | "unknown";

interface Props {
  annualAmount: string;
  yieldPct: string;
  payoutPct: string;
  fcfCoverage: string;
  growth3Y: string;
  growth5Y: string;
  sustainability: Sustainability;
}

const VERDICT: Record<Sustainability, { label: string; summary: string; badge: string; value: string }> = {
  healthy: {
    label: "Sustainable",
    summary: "Payout ratio and free cash flow coverage suggest this dividend is well-supported by earnings and cash generation.",
    badge: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  moderate: {
    label: "Monitor",
    summary: "Dividend is currently covered but the payout ratio or cash flow coverage leaves limited room for earnings pressure.",
    badge: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    value: "text-amber-500 dark:text-amber-400",
  },
  risk: {
    label: "At Risk",
    summary: "High payout ratio or weak free cash flow coverage — the dividend may not be sustainable if earnings decline.",
    badge: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
    value: "text-red-500 dark:text-red-400",
  },
  unknown: {
    label: "Insufficient Data",
    summary: "Not enough data to assess dividend sustainability.",
    badge: "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
    value: "text-zinc-500",
  },
};

function payoutColor(pct: number) {
  if (pct <= 40) return "bg-emerald-500";
  if (pct <= 60) return "bg-teal-500";
  if (pct <= 80) return "bg-amber-400";
  return "bg-red-500";
}

function fcfColor(cov: number) {
  if (cov >= 1.5) return "bg-emerald-500";
  if (cov >= 1.0) return "bg-teal-500";
  if (cov >= 0.8) return "bg-amber-400";
  return "bg-red-500";
}

export default function DividendMetrics({
  annualAmount, yieldPct, payoutPct, fcfCoverage, growth3Y, growth5Y, sustainability,
}: Props) {
  const verdict = VERDICT[sustainability];
  const payoutNum = parseFloat(payoutPct) || 0;
  const fcfNum    = parseFloat(fcfCoverage) || 0;

  return (
    <div className={`rounded-xl border p-5 ${verdict.badge}`}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dividend Analysis</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Payout Ratio = Annual Dividend ÷ EPS &nbsp;·&nbsp; FCF Coverage = FCF/sh ÷ Annual Dividend
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${verdict.badge}`}>
          {verdict.label}
        </span>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Dividend Yield</p>
          <p className={`text-2xl font-bold ${verdict.value}`}>
            {yieldPct ? `${yieldPct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Annual / Share</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {annualAmount ? `$${annualAmount}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">3Y Growth</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {growth3Y || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">5Y Growth</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {growth5Y || "—"}
          </p>
        </div>
      </div>

      {/* Payout ratio bar */}
      {payoutNum > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span>Payout Ratio</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{payoutPct}%</span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${payoutColor(payoutNum)}`}
              style={{ width: `${Math.min(payoutNum, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>0%</span>
            <span className="text-zinc-400">≤40% healthy · ≤60% fine · ≤80% watch · &gt;80% risky</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* FCF Coverage bar */}
      {fcfNum > 0 && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span>FCF Coverage</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{fcfCoverage}x</span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fcfColor(fcfNum)}`}
              style={{ width: `${Math.min((fcfNum / 3) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>0x</span>
            <span className="text-zinc-400">≥1.5x well covered · ≥1.0x covered · &lt;0.8x at risk</span>
            <span>3x</span>
          </div>
        </div>
      )}

      {/* Verdict */}
      <div className="rounded-lg bg-white/50 dark:bg-black/30 border border-white/60 dark:border-zinc-700 px-4 py-3">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{verdict.summary}</p>
      </div>
    </div>
  );
}
