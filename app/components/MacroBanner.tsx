"use client";

import { useEffect, useState } from "react";

interface MacroData {
  regime: "risk-on" | "neutral" | "risk-off";
  vix: number | null;
  rates: {
    tenYear: number | null;
    twoYear: number | null;
    fedFunds: number | null;
    yieldCurve: number | null;
    isInverted: boolean;
  };
  spy: {
    sma200: number | null;
    aboveMA200: boolean;
  };
  cached: boolean;
  fetchedAt: string;
}

const REGIME = {
  "risk-on": {
    label: "Risk-On",
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  neutral: {
    label: "Neutral",
    bg: "bg-amber-50 dark:bg-amber-950/60",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "risk-off": {
    label: "Risk-Off",
    bg: "bg-red-50 dark:bg-red-950/60",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

function fmt(n: number | null, decimals = 2, suffix = ""): string {
  return n != null ? `${n.toFixed(decimals)}${suffix}` : "—";
}

function signed(n: number | null, decimals = 2, suffix = ""): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(decimals)}${suffix}`;
}

export default function MacroBanner() {
  const [data, setData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/macro")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse mb-6" />
    );
  }
  if (!data) return null;

  const regime = REGIME[data.regime];
  const vix = data.vix;
  const { tenYear, yieldCurve, isInverted, fedFunds } = data.rates;
  const { sma200, aboveMA200 } = data.spy;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 rounded-xl border ${regime.bg} ${regime.border} mb-6 text-xs`}
    >
      {/* Regime badge */}
      <div className={`flex items-center gap-1.5 font-semibold ${regime.text} shrink-0`}>
        <span className={`w-2 h-2 rounded-full ${regime.dot} animate-pulse`} />
        Market Regime: {regime.label}
      </div>

      <span className="text-zinc-300 dark:text-zinc-600 hidden sm:block">|</span>

      {/* VIX */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-zinc-500 dark:text-zinc-400">VIX</span>
        <span
          className={`font-semibold ${
            vix == null
              ? "text-zinc-400"
              : vix < 18
              ? "text-emerald-600 dark:text-emerald-400"
              : vix > 25
              ? "text-red-500"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {fmt(vix, 1)}
        </span>
        {vix != null && (
          <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">
            · {vix < 18 ? "Calm" : vix > 25 ? "Fear" : "Elevated"}
          </span>
        )}
      </div>

      <span className="text-zinc-300 dark:text-zinc-600 hidden sm:block">|</span>

      {/* 10Y yield */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-zinc-500 dark:text-zinc-400">10Y</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {fmt(tenYear, 2, "%")}
        </span>
      </div>

      {/* Fed Funds */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-zinc-500 dark:text-zinc-400">Fed</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {fmt(fedFunds, 2, "%")}
        </span>
      </div>

      <span className="text-zinc-300 dark:text-zinc-600 hidden sm:block">|</span>

      {/* Yield curve */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-zinc-500 dark:text-zinc-400">2Y–10Y</span>
        <span
          className={`font-semibold ${
            isInverted ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {signed(yieldCurve, 2, "%")}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">
          · {isInverted ? "Inverted" : "Normal"}
        </span>
      </div>

      <span className="text-zinc-300 dark:text-zinc-600 hidden sm:block">|</span>

      {/* SPY vs MA200 */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-zinc-500 dark:text-zinc-400">SPY vs MA200</span>
        <span
          className={`font-semibold ${
            sma200 == null
              ? "text-zinc-400"
              : aboveMA200
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500"
          }`}
        >
          {signed(sma200, 1, "%")}
        </span>
        <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">
          · {aboveMA200 ? "Uptrend" : "Below"}
        </span>
      </div>

      <a
        href="/macro"
        className="ml-auto text-indigo-500 dark:text-indigo-400 hover:underline hidden sm:block shrink-0"
      >
        Full dashboard →
      </a>
    </div>
  );
}
