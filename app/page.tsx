"use client";

import { useState } from "react";
import StocksTable from "./components/StocksTable";

const TABS = [
  { key: "megacap", label: "Mega Cap" },
  { key: "largecap", label: "Large Cap" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("megacap");

  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 w-full max-w-full">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
        Stock Screener
      </h1>

      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <StocksTable screener={activeTab} />
    </div>
  );
}
