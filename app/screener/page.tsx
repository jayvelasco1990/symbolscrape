"use client";

import { useRouter, useSearchParams } from "next/navigation";
import StocksTable from "../components/StocksTable";

const TABS = [
  { key: "megacap",  label: "Mega Cap",  description: "Market cap > $200B" },
  { key: "largecap", label: "Large Cap", description: "Market cap $10B–$200B · USA" },
  { key: "smallcap", label: "Small Cap", description: "Market cap $300M–$2B · USA" },
];

const BETA_OPTIONS = [
  { value: "",     label: "Any Beta" },
  { value: "u0.5", label: "Beta < 0.5" },
  { value: "u1",   label: "Beta < 1" },
  { value: "u1.5", label: "Beta < 1.5" },
  { value: "u2",   label: "Beta < 2" },
  { value: "o0.5", label: "Beta > 0.5" },
  { value: "o1",   label: "Beta > 1" },
  { value: "o1.5", label: "Beta > 1.5" },
  { value: "o2",   label: "Beta > 2" },
];

export default function ScreenerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "megacap";
  const page      = parseInt(searchParams.get("page") ?? "1", 10);
  const dividend  = searchParams.get("dividend") === "true";
  const rsi       = searchParams.get("rsi") === "true";
  const beta      = searchParams.get("beta") ?? "";
  const activeTabData = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  function buildUrl(overrides: Record<string, string | number | boolean>) {
    const params = {
      tab: activeTab,
      page: String(page),
      dividend: String(dividend),
      rsi: String(rsi),
      beta,
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    return `/screener?${new URLSearchParams(params).toString()}`;
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
            Stocks filtered by beta, RSI, and market cap
          </p>

          {/* Tabs + filter row */}
          <div className="flex items-center justify-between mt-6 flex-wrap gap-4">
            <div className="flex gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => router.push(buildUrl({ tab: tab.key, page: 1 }))}
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

            {/* Filter toggles */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => router.push(buildUrl({ dividend: !dividend, page: 1 }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  dividend
                    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${dividend ? "bg-emerald-500" : "bg-zinc-400"}`} />
                Dividend
              </button>
              <button
                onClick={() => router.push(buildUrl({ rsi: !rsi, page: 1 }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  rsi
                    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${rsi ? "bg-emerald-500" : "bg-zinc-400"}`} />
                RSI &lt; 50
              </button>
              <select
                value={beta}
                onChange={(e) => router.push(buildUrl({ beta: e.target.value, page: 1 }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                  beta
                    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {BETA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
            {activeTabData.description}{dividend ? " · Dividend" : ""}{rsi ? " · RSI < 50" : ""}{beta ? ` · ${BETA_OPTIONS.find(o => o.value === beta)?.label}` : ""}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <StocksTable
          screener={activeTab}
          page={page}
          dividend={dividend}
          rsi={rsi}
          beta={beta}
          onPageChange={(p) => router.push(buildUrl({ page: p }))}
        />
      </div>
    </div>
  );
}
