interface Props {
  debtToRevenue?: string;
  debtToEbitda?: string;
}

function parseNum(s: string) {
  return parseFloat(s) || 0;
}

type RiskLevel = "low" | "moderate" | "elevated" | "high";

function revenueRisk(v: number): RiskLevel {
  if (v < 0.5) return "low";
  if (v < 1.5) return "moderate";
  if (v < 3) return "elevated";
  return "high";
}

function ebitdaRisk(v: number): RiskLevel {
  if (v < 2) return "low";
  if (v < 3) return "moderate";
  if (v < 4) return "elevated";
  return "high";
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Conservative",
  moderate: "Moderate",
  elevated: "Elevated",
  high: "High Leverage",
};

const RISK_VALUE_COLOR: Record<RiskLevel, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-500 dark:text-amber-400",
  elevated: "text-orange-500 dark:text-orange-400",
  high: "text-red-500 dark:text-red-400",
};

const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  moderate: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  elevated: "bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
  high: "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800",
};

const RISK_BAR: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-400",
  elevated: "bg-orange-500",
  high: "bg-red-500",
};

function MetricBar({ value, max, risk }: { value: number; max: number; risk: RiskLevel }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="mt-3">
      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${RISK_BAR[risk]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-400 mt-1">
        <span>0x</span>
        <span>{max}x</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  risk,
  description,
  barMax,
}: {
  label: string;
  value: number;
  risk: RiskLevel;
  description: string;
  barMax: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_BADGE[risk]}`}>
          {RISK_LABEL[risk]}
        </span>
      </div>
      <p className={`text-2xl font-bold ${RISK_VALUE_COLOR[risk]}`}>{value.toFixed(2)}x</p>
      <MetricBar value={value} max={barMax} risk={risk} />
      <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

export default function DebtMetrics({ debtToRevenue, debtToEbitda }: Props) {
  if (!debtToRevenue && !debtToEbitda) return null;

  const dtrVal = parseNum(debtToRevenue ?? "");
  const dteVal = parseNum(debtToEbitda ?? "");

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Debt Metrics</h3>
      <div className="grid grid-cols-2 gap-4">
        {debtToRevenue && (
          <MetricCard
            label="Debt / Revenue"
            value={dtrVal}
            risk={revenueRisk(dtrVal)}
            barMax={4}
            description="Total debt relative to annual revenue. Below 0.5x is conservative; above 3x signals elevated leverage."
          />
        )}
        {debtToEbitda && (
          <MetricCard
            label="Debt / EBITDA"
            value={dteVal}
            risk={ebitdaRisk(dteVal)}
            barMax={6}
            description="Years of earnings needed to repay debt. Below 2x is healthy; above 4x is considered high leverage."
          />
        )}
      </div>
    </div>
  );
}
