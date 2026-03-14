"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import StockDetail from "@/app/components/StockDetail";
import WatchlistButton from "@/app/components/WatchlistButton";

export default function StockPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticker = (params.ticker as string) ?? "";
  const symbol = ticker.toUpperCase();
  const initialPrice = searchParams.get("price") ?? undefined;
  const back = searchParams.get("back") ?? "/screener";

  const [resolvedPrice, setResolvedPrice] = useState<string | undefined>(initialPrice);

  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 max-w-4xl mx-auto">
      <Link
        href={back}
        className="text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 inline-block transition-colors"
      >
        ← Back to screener
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{symbol}</h1>
        <WatchlistButton ticker={symbol} price={resolvedPrice} />
      </div>

      <StockDetail ticker={ticker} initialPrice={initialPrice} onPriceResolved={setResolvedPrice} />
    </div>
  );
}
