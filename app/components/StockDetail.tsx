"use client";

import { useEffect, useState } from "react";

interface RevenueQuarter {
  label: string;
  revenue: number;
  revenueFormatted?: string;
  growthPct: number | null;
}
import IntrinsicValue from "./IntrinsicValue";
import DebtMetrics from "./DebtMetrics";
import DividendMetrics from "./DividendMetrics";
import DisruptionRisk from "./DisruptionRisk";
import BusinessQuality from "./BusinessQuality";
import GrowthMetrics from "./GrowthMetrics";

type TableRow = Record<string, string>;

interface QuoteData {
  ticker: string;
  price: string;
  priceChange: string;
  description: string;
  financials: {
    incomeStatement: TableRow[];
    balanceSheet: TableRow[];
    cashFlow: TableRow[];
  };
  intrinsicValue?: { fairValue: string; formula?: string; note?: string };
  netCashPerShare?: string;
  debtToRevenue?: string;
  debtToEbitda?: string;
  dividendMetrics?: {
    annualAmount: string;
    yieldPct: string;
    payoutPct: string;
    fcfCoverage: string;
    growth3Y: string;
    growth5Y: string;
    sustainability: "healthy" | "moderate" | "risk" | "unknown";
  } | null;
  moatQuality?: {
    score: number;
    level: "Strong" | "Moderate" | "Narrow" | "Weak";
    roe: string; roic: string; profitMargin: string; operMargin: string;
  };
  insiderActivity?: {
    ownershipPct: string; transPct: string; trans: number;
    trend: "Buying" | "Neutral" | "Selling";
    ownershipLevel: "High" | "Moderate" | "Low";
  };
  riskProfile?: {
    sector: string;
    climate: { score: number; level: "Low" | "Moderate" | "High" | "Severe"; rationale: string };
  };
  rateSensitivity?: {
    score: number; level: "Low" | "Moderate" | "High" | "Severe"; rationale: string;
  };
  growthMetrics?: {
    revenueGrowthPct: string;
    grossMarginPct: string;
    fcfMarginPct: string;
    rule40: string;
    evToRevenue: string;
  } | null;
}

// Format a raw number string for display: 37154298 → 37,154,298
function formatCellValue(v: string): string {
  if (!v || v === "—") return v || "—";
  const stripped = v.replace(/,/g, "").trim();
  const num = Number(stripped);
  if (!isNaN(num) && stripped !== "" && /^-?[\d.]+$/.test(stripped)) {
    if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(num) >= 1_000_000)     return `${(num / 1_000_000).toFixed(2)}M`;
    if (Math.abs(num) >= 1_000)         return num.toLocaleString();
    return v;
  }
  return v;
}

// Detect the label column (the one with the most non-numeric values)
function getLabelColumn(headers: string[], rows: TableRow[]): string | null {
  for (const h of headers) {
    const vals = rows.map((r) => r[h] ?? "").filter(Boolean);
    const numericCount = vals.filter((v) => !isNaN(Number(v.replace(/,/g, "")))).length;
    if (numericCount < vals.length / 2) return h;
  }
  return null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mt-2 mb-1">
      {children}
    </p>
  );
}

function FinancialTable({ title, rows, units }: { title: string; rows: TableRow[]; units?: string }) {
  if (!rows.length) return null;
  const allHeaders = Object.keys(rows[0]);
  const labelCol = getLabelColumn(allHeaders, rows);
  const headers = labelCol
    ? [labelCol, ...allHeaders.filter((h) => h !== labelCol)]
    : allHeaders;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-black">
      <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {units && <span className="text-xs text-zinc-400">{units}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-left font-semibold whitespace-nowrap ${
                    i === 0
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-zinc-50 dark:border-zinc-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors ${
                  i % 2 === 1 ? "bg-zinc-50/40 dark:bg-zinc-900/20" : ""
                }`}
              >
                {headers.map((h, j) => (
                  <td
                    key={h}
                    className={`px-4 py-2.5 whitespace-nowrap ${
                      j === 0
                        ? "font-medium text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-600 dark:text-zinc-400 tabular-nums"
                    }`}
                  >
                    {j === 0 ? (row[h] || "—") : formatCellValue(row[h] || "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Detect units hint from column headers (e.g. "Millions (USD)")
function extractUnits(rows: TableRow[]): string | undefined {
  if (!rows.length) return undefined;
  const headers = Object.keys(rows[0]);
  const unitCol = headers.find((h) => /million|billion|USD|EUR|JPY/i.test(h));
  return unitCol ?? undefined;
}

export default function StockDetail({
  ticker,
  initialPrice,
  onPriceResolved,
}: {
  ticker: string;
  initialPrice?: string;
  onPriceResolved?: (price: string) => void;
}) {
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueHistory, setRevenueHistory] = useState<RevenueQuarter[] | null>(null);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/quote`)
      .then((r) => r.json())
      .then((d: QuoteData) => {
        setData(d);
        const resolved = initialPrice || d.price;
        if (resolved) onPriceResolved?.(resolved);
      })
      .catch(() => setError("Failed to load stock data."))
      .finally(() => setLoading(false));

    fetch(`/api/stocks/${ticker}/revenue`)
      .then((r) => r.json())
      .then((d: { quarters: RevenueQuarter[] }) => {
        if (d.quarters?.length) setRevenueHistory(d.quarters);
      })
      .catch(() => {});
  }, [ticker]);

  if (loading)
    return (
      <div className="flex items-center gap-2 py-12 text-zinc-400 text-sm animate-pulse">
        Loading data…
      </div>
    );
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return null;

  const iv    = data.intrinsicValue;
  const price = initialPrice || data.price || "";
  const { incomeStatement, balanceSheet, cashFlow } = data.financials;
  const hasFinancials = incomeStatement.length > 0 || balanceSheet.length > 0 || cashFlow.length > 0;

  return (
    <div className="flex flex-col gap-3">

      {/* ── Valuation ───────────────────────────────── */}
      {iv && (
        <>
          <SectionLabel>Valuation</SectionLabel>
          <IntrinsicValue
            price={price}
            fairValue={iv.fairValue}
            formula={iv.formula}
            note={iv.note}
            netCashPerShare={data.netCashPerShare}
          />
        </>
      )}

      {/* ── Financial Health ────────────────────────── */}
      {(data.debtToRevenue || data.debtToEbitda || data.dividendMetrics) && (
        <SectionLabel>Financial Health</SectionLabel>
      )}
      <DebtMetrics debtToRevenue={data.debtToRevenue} debtToEbitda={data.debtToEbitda} />
      {data.dividendMetrics && <DividendMetrics {...data.dividendMetrics} />}

      {/* ── Growth & Profitability ──────────────────── */}
      {(revenueHistory?.length || (data.growthMetrics && (
        data.growthMetrics.revenueGrowthPct || data.growthMetrics.grossMarginPct
      ))) && (
        <>
          <SectionLabel>Growth & Profitability</SectionLabel>
          <GrowthMetrics
            revenueGrowthPct={data.growthMetrics?.revenueGrowthPct ?? ""}
            grossMarginPct={data.growthMetrics?.grossMarginPct ?? ""}
            fcfMarginPct={data.growthMetrics?.fcfMarginPct ?? ""}
            rule40={data.growthMetrics?.rule40 ?? ""}
            evToRevenue={data.growthMetrics?.evToRevenue ?? ""}
            revenueHistory={revenueHistory}
          />
        </>
      )}

      {/* ── Business Quality ────────────────────────── */}
      {data.moatQuality && data.insiderActivity && (
        <>
          <SectionLabel>Business Quality</SectionLabel>
          <BusinessQuality moat={data.moatQuality} insider={data.insiderActivity} />
        </>
      )}

      {/* ── Risk Factors ────────────────────────────── */}
      {data.riskProfile?.sector && data.rateSensitivity && (
        <>
          <SectionLabel>Risk Factors</SectionLabel>
          <DisruptionRisk
            sector={data.riskProfile.sector}
            climate={data.riskProfile.climate}
            rate={data.rateSensitivity}
          />
        </>
      )}

      {/* ── About ───────────────────────────────────── */}
      {data.description && (
        <>
          <SectionLabel>About</SectionLabel>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black p-5">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {data.description}
            </p>
          </div>
        </>
      )}

      {/* ── Financials ──────────────────────────────── */}
      {hasFinancials && <SectionLabel>Financials</SectionLabel>}
      <FinancialTable
        title="Income Statement"
        rows={incomeStatement}
        units={extractUnits(incomeStatement)}
      />
      <FinancialTable
        title="Balance Sheet"
        rows={balanceSheet}
        units={extractUnits(balanceSheet)}
      />
      <FinancialTable
        title="Cash Flow"
        rows={cashFlow}
        units={extractUnits(cashFlow)}
      />

      {!price && !data.description && !hasFinancials && !iv?.fairValue && (
        <p className="text-sm text-zinc-400 py-8 text-center">
          No data could be extracted for {ticker.toUpperCase()}.
        </p>
      )}
    </div>
  );
}
