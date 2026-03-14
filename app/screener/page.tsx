"use client";

import { useRouter, useSearchParams } from "next/navigation";
import StocksTable from "../components/StocksTable";

const TABS = [
  {
    key: "megacap",
    label: "Mega Cap",
    description: "Market cap > $200B · Dividend · Low beta · RSI < 50",
  },
  {
    key: "largecap",
    label: "Large Cap",
    description: "Market cap $10B–$200B · Dividend · USA · Low beta · RSI < 50",
  },
  {
    key: "smallcap",
    label: "Small Cap",
    description: "Market cap $300M–$2B · Dividend · USA · Low beta · RSI < 50",
  },
];

export default function ScreenerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "megacap";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const activeTabData = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  function setTab(tab: string) {
    router.push(`/screener?tab=${tab}&page=1`);
  }

  function setPage(p: number) {
    router.push(`/screener?tab=${activeTab}&page=${p}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-2">
            Value Screener
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Stock Screener</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Dividend-paying stocks filtered by beta, RSI, and market cap
          </p>

          <div className="flex gap-2 mt-6">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
            {activeTabData.description}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <StocksTable screener={activeTab} page={page} onPageChange={setPage} />
      </div>
    </div>
  );
}
