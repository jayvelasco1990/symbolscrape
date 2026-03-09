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

export default function StocksTable() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stocks")
      .then((r) => r.json())
      .then((data) => {
        setHeaders(data.headers ?? []);
        setRows(data.rows ?? []);
      })
      .catch(() => setError("Failed to load stock data."))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnDef<Row>[] = headers.map((h) => ({
    accessorKey: h,
    header: h,
    cell: (info) => {
      const value = info.getValue() as string;
      if (h === "Ticker") {
        return (
          <Link
            href={`/stocks/${value}`}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
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

  if (loading) return <p className="text-zinc-400">Loading stocks...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!rows.length) return <p className="text-zinc-400">No results found.</p>;

  return (
    <div className="w-full">
      <table className="w-full text-xs border-collapse table-fixed">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-zinc-200 dark:border-zinc-700">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className="px-2 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-400 truncate cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100"
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
              className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${
                i % 2 === 0 ? "" : "bg-zinc-50/50 dark:bg-zinc-900/30"
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-2 py-2 text-zinc-800 dark:text-zinc-200 truncate"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
