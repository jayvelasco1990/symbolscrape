"use client";

import { useEffect, useState } from "react";

export default function WatchlistButton({ ticker, price }: { ticker: string; price?: string }) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((items: { ticker: string }[]) => {
        setWatching(items.some((i) => i.ticker === ticker.toUpperCase()));
        setLoading(false);
      });
  }, [ticker]);

  async function toggle() {
    setLoading(true);
    if (watching) {
      await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      setWatching(false);
    } else {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, price }),
      });
      setWatching(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 ${
        watching
          ? "bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
          : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {watching ? "★ Watching" : "☆ Watch"}
    </button>
  );
}
