"use client";

import { useEffect, useState } from "react";
import IntrinsicValue from "./IntrinsicValue";

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
  intrinsicValue?: {
    fairValue: string;
    formula?: string;
    note?: string;
  };
}

function FinancialTable({ title, rows }: { title: string; rows: TableRow[] }) {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-b border-zinc-50 dark:border-zinc-900 ${i % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-900/30" : ""}`}>
                {headers.map((h) => (
                  <td key={h} className="px-4 py-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {row[h] || "—"}
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

export default function StockDetail({ ticker, initialPrice }: { ticker: string; initialPrice?: string }) {
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/quote`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load stock data."))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading)
    return <p className="text-zinc-400 text-sm animate-pulse">Loading data...</p>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return null;

  const iv = data.intrinsicValue;
  const price = initialPrice || data.price || "";

  return (
    <div className="flex flex-col gap-4">
      {iv && (
        <IntrinsicValue
          price={price}
          fairValue={iv.fairValue}
          formula={iv.formula}
          note={iv.note}
        />
      )}

      {data.description && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">About</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {data.description}
          </p>
        </div>
      )}

      <FinancialTable title="Income Statement" rows={data.financials.incomeStatement} />
      <FinancialTable title="Balance Sheet" rows={data.financials.balanceSheet} />
      <FinancialTable title="Cash Flow" rows={data.financials.cashFlow} />

      {!price && !data.description &&
        !data.financials.incomeStatement.length &&
        !data.financials.balanceSheet.length &&
        !data.financials.cashFlow.length &&
        !iv?.fairValue && (
          <p className="text-sm text-zinc-400">
            No data could be extracted for {ticker.toUpperCase()}.
          </p>
        )}
    </div>
  );
}
