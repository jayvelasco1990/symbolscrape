interface RevenueQuarter {
  label: string;
  revenue: number;
  revenueFormatted?: string;
  growthPct: number | null;
}

interface Props {
  revenueGrowthPct: string;
  grossMarginPct: string;
  fcfMarginPct: string;
  rule40: string;
  evToRevenue: string;
  revenueHistory?: RevenueQuarter[] | null;
}

function parseNum(s: string): number {
  return parseFloat(s) || 0;
}

type Level = "strong" | "ok" | "weak" | "empty";

function numColor(level: Level): string {
  if (level === "strong") return "text-emerald-600 dark:text-emerald-400";
  if (level === "ok")     return "text-amber-600 dark:text-amber-400";
  if (level === "weak")   return "text-red-500 dark:text-red-400";
  return "text-zinc-400";
}

function barColor(level: Level): string {
  if (level === "strong") return "bg-emerald-500";
  if (level === "ok")     return "bg-amber-400";
  if (level === "weak")   return "bg-red-400";
  return "bg-zinc-200 dark:bg-zinc-700";
}

function MetricRow({
  label,
  value,
  suffix = "%",
  level,
  barPct,
  note,
}: {
  label: string;
  value: string;
  suffix?: string;
  level: Level;
  barPct: number;
  note?: string;
}) {
  const isEmpty = !value && value !== "0";
  const display = isEmpty ? "—" : `${value}${suffix}`;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-500 dark:text-zinc-400 w-32 shrink-0">{label}</span>
        <span className={`font-semibold tabular-nums ${numColor(isEmpty ? "empty" : level)}`}>
          {display}
        </span>
        {note && <span className={`text-[10px] w-14 text-right ${numColor(isEmpty ? "empty" : level)}`}>{note}</span>}
      </div>
      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(isEmpty ? "empty" : level)}`}
          style={{ width: `${Math.max(0, Math.min(barPct, 100))}%` }}
        />
      </div>
    </div>
  );
}

function RevenueSparkline({ quarters }: { quarters: RevenueQuarter[] }) {
  const visible = quarters.slice(-6);
  const maxRev = Math.max(...visible.map((q) => q.revenue));

  return (
    <div className="mb-5 pb-5 border-b border-zinc-100 dark:border-zinc-800">
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">
        Revenue Trend · Last {visible.length} Quarters (YoY)
      </p>

      {/* Growth % labels */}
      <div className="flex gap-1.5 mb-0.5">
        {visible.map((q, i) => (
          <div key={i} className="flex-1 flex justify-center">
            {q.growthPct !== null ? (
              <span className={`text-[9px] font-bold tabular-nums ${
                q.growthPct >= 5 ? "text-emerald-600 dark:text-emerald-400"
                : q.growthPct >= 0 ? "text-amber-500 dark:text-amber-400"
                : "text-red-500 dark:text-red-400"
              }`}>
                {q.growthPct > 0 ? "+" : ""}{q.growthPct.toFixed(0)}%
              </span>
            ) : (
              <span className="text-[9px] text-zinc-300 dark:text-zinc-600">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-1.5 h-10">
        {visible.map((q, i) => {
          const heightPct = Math.max(12, (q.revenue / maxRev) * 100);
          const barCls =
            q.growthPct === null ? "bg-zinc-200 dark:bg-zinc-700"
            : q.growthPct >= 5  ? "bg-emerald-400 dark:bg-emerald-500"
            : q.growthPct >= 0  ? "bg-amber-400 dark:bg-amber-500"
            :                     "bg-red-400 dark:bg-red-500";
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end" style={{ height: "100%" }}>
              <div
                title={q.revenueFormatted ?? `$${(q.revenue / 1e9).toFixed(1)}B`}
                className={`w-full rounded-t-sm transition-all ${barCls}`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Quarter labels */}
      <div className="flex gap-1.5 mt-1">
        {visible.map((q, i) => (
          <div key={i} className="flex-1 flex justify-center">
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center leading-tight">{q.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GrowthMetrics({
  revenueGrowthPct,
  grossMarginPct,
  fcfMarginPct,
  rule40,
  evToRevenue,
  revenueHistory,
}: Props) {
  const hasAny = revenueGrowthPct || grossMarginPct || fcfMarginPct || rule40 || revenueHistory?.length;
  if (!hasAny) return null;

  const revG   = parseNum(revenueGrowthPct);
  const grossM = parseNum(grossMarginPct);
  const fcfM   = parseNum(fcfMarginPct);
  const r40    = parseNum(rule40);
  const evRev  = parseNum(evToRevenue);

  const revLevel: Level  = !revenueGrowthPct ? "empty" : revG >= 20 ? "strong" : revG >= 5 ? "ok" : "weak";
  const grossLevel: Level = !grossMarginPct  ? "empty" : grossM >= 60 ? "strong" : grossM >= 40 ? "ok" : "weak";
  const fcfLevel: Level   = !fcfMarginPct   ? "empty" : fcfM >= 15 ? "strong" : fcfM >= 0 ? "ok" : "weak";
  const r40Level: Level   = !rule40         ? "empty" : r40 >= 40 ? "strong" : r40 >= 20 ? "ok" : "weak";

  const evNote = !evToRevenue ? "" : evRev > 10 ? "Expensive" : evRev > 5 ? "Premium" : evRev > 2 ? "Fair" : "Cheap";
  const evLevel: Level = !evToRevenue ? "empty" : evRev > 10 ? "weak" : evRev > 5 ? "ok" : "strong";

  const r40Note = !rule40 ? "" : r40 >= 40 ? "Efficient" : r40 >= 20 ? "Adequate" : "Inefficient";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Growth & Profitability</p>
          <p className="text-xs text-zinc-400 mt-0.5">Key metrics for evaluating growth companies</p>
        </div>
        {rule40 && (
          <div className={`text-right`}>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              r40Level === "strong" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" :
              r40Level === "ok"     ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" :
                                     "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
            }`}>
              Rule of 40: {r40 > 0 ? "+" : ""}{rule40}
            </span>
          </div>
        )}
      </div>

      {revenueHistory && revenueHistory.length >= 3 && (
        <RevenueSparkline quarters={revenueHistory} />
      )}

      <div className="flex flex-col gap-3">
        {revenueGrowthPct && (
          <MetricRow
            label="Revenue Growth YoY"
            value={revenueGrowthPct}
            level={revLevel}
            barPct={(revG / 40) * 100}
          />
        )}
        {grossMarginPct && (
          <MetricRow
            label="Gross Margin"
            value={grossMarginPct}
            level={grossLevel}
            barPct={grossM}
          />
        )}
        {fcfMarginPct && (
          <MetricRow
            label="FCF Margin"
            value={fcfMarginPct}
            level={fcfLevel}
            barPct={Math.max(0, fcfM) * 2}
          />
        )}
        {rule40 && (
          <MetricRow
            label="Rule of 40"
            value={rule40}
            suffix=""
            level={r40Level}
            barPct={(r40 / 60) * 100}
            note={r40Note}
          />
        )}
        {evToRevenue && (
          <MetricRow
            label="EV / Revenue"
            value={evToRevenue}
            suffix="x"
            level={evLevel}
            barPct={Math.min((evRev / 15) * 100, 100)}
            note={evNote}
          />
        )}
      </div>

      <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-4 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-3">
        Rule of 40 = Revenue Growth % + FCF Margin %. Score ≥ 40 signals a healthy balance of growth and profitability.
        EV/Revenue is used when P/E is unavailable. Source: Yahoo Finance
      </p>
    </div>
  );
}
