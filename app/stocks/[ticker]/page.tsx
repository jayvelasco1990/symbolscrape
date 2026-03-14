"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import StockDetail from "@/app/components/StockDetail";

export default function StockPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticker = (params.ticker as string) ?? "";
  const symbol = ticker.toUpperCase();
  const price = searchParams.get("price") ?? undefined;
  const back = searchParams.get("back") ?? "/screener";

  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 max-w-4xl mx-auto">
      <Link
        href={back}
        className="text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 inline-block transition-colors"
      >
        ← Back to screener
      </Link>

      <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">{symbol}</h1>

      <StockDetail ticker={ticker} initialPrice={price} />
    </div>
  );
}
