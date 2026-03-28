"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = Record<string, string>;
const PAGE_SIZE = 20;

interface Props {
  screener: string;
  page: number;
  dividend: boolean;
  rsi: boolean;
  beta: string;
  onPageChange: (page: number) => void;
}

export default function StocksTable({ screener, page, dividend, rsi, beta, onPageChange }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setRows([]);
    setHeaders([]);
    const r = (page - 1) * PAGE_SIZE + 1;
    fetch(`/api/stocks?screener=${screener}&r=${r}&dividend=${dividend}&rsi=${rsi}&beta=${beta}`)
      .then((res) => res.json())
      .then((data) => {
        setHeaders(data.headers ?? []);
        setRows(data.rows ?? []);
      })
      .catch(() => setError("Failed to load stock data."))
      .finally(() => setLoading(false));
  }, [screener, page, dividend, rsi, beta]);

  const SIGNAL_STYLE: Record<string, string> = {
    "Strong Buy": "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
    "Buy":        "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
    "Neutral":    "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
    "Avoid":      "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
    "No Data":    "",
  };

  const columns: ColumnDef<Row>[] = headers.map((h) => ({
    accessorKey: h,
    header: h,
    cell: (info) => {
      const value = info.getValue() as string;

      if (h === "Signal") {
        if (value === "No Data") {
          return (
            <span
              className="text-zinc-300 dark:text-zinc-600 text-[10px]"
              title="Insufficient data to compute signal (P/B unavailable)"
            >
              —
            </span>
          );
        }
        const cls = SIGNAL_STYLE[value] ?? SIGNAL_STYLE["Avoid"];
        return (
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${cls}`}
            title="Graham Rule (PE×PB<22.5) + P/E<20 + P/FCF<35 + EPS growth"
          >
            {value}
          </span>
        );
      }

      if (h === "RS") {
        if (!value) return <span className="text-zinc-300 dark:text-zinc-600 text-[10px]">—</span>;
        const [numStr, trend] = value.split("|");
        const num = parseFloat(numStr);
        const color =
          num >  2 ? "text-emerald-600 dark:text-emerald-400" :
          num >  0 ? "text-emerald-500 dark:text-emerald-500" :
          num < -2 ? "text-red-500" : "text-red-400";
        const trendColor =
          trend === "↑" ? "text-emerald-500 dark:text-emerald-400" :
          trend === "↓" ? "text-red-400" : "text-zinc-400";
        return (
          <span className="flex items-center gap-0.5 whitespace-nowrap" title="Relative Strength vs sector ETF (YTD). Arrow shows if RS is accelerating (↑) or fading (↓) vs 1M.">
            <span className={`font-semibold text-[11px] ${color}`}>
              {num > 0 ? "+" : ""}{numStr}%
            </span>
            {trend && <span className={`text-[10px] ${trendColor}`}>{trend}</span>}
          </span>
        );
      }

      if (h === "Ticker") {
        const price = info.row.original["Price"] ?? "";
        const back = encodeURIComponent(`/screener?tab=${screener}&page=${page}&dividend=${dividend}&rsi=${rsi}&beta=${beta}`);
        const href = `/stocks/${value}?price=${encodeURIComponent(price)}&back=${back}`;
        return (
          <Link
            href={href}
            className="inline-block font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            {value}
          </Link>
        );
      }

      return value;
    },
  }));

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const isLastPage = rows.length < PAGE_SIZE;

  if (loading) return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm py-12 justify-center">
      <span className="animate-pulse">Loading stocks…</span>
    </div>
  );
  if (error) return <p className="text-red-500 text-sm py-8 text-center">{error}</p>;
  if (!rows.length) return <p className="text-zinc-400 text-sm py-8 text-center">No results found.</p>;

  return (
    <div className="w-full">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-black shadow-sm">
        <table className="w-full text-xs border-collapse table-fixed">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-3 text-left font-semibold text-zinc-500 dark:text-zinc-400 truncate cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc"
                      ? " ↑"
                      : header.column.getIsSorted() === "desc"
                      ? " ↓"
                      : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors ${
                  i % 2 === 0 ? "bg-white dark:bg-black" : "bg-zinc-50/50 dark:bg-zinc-900/30"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2.5 text-zinc-700 dark:text-zinc-300 truncate"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          ← Previous
        </button>
        <span className="text-xs text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg shadow-sm">
          {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={isLastPage}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
