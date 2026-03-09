"use client";

import { useEffect, useState } from "react";

export default function StockSummary({ ticker }: { ticker: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        const res = await fetch(`/api/stocks/${ticker}/summary`);
        if (!res.ok || !res.body) throw new Error("Failed to fetch summary");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        setLoading(false);

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          setText((prev) => prev + decoder.decode(value, { stream: true }));
        }
      } catch {
        if (!cancelled) setError("Failed to load summary.");
        setLoading(false);
      }
    }

    fetchSummary();
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <span className="animate-pulse">Researching latest coverage for {ticker.toUpperCase()}...</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-6 mb-2">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <li key={i} className="ml-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
              {line.replace(/^[-•]\s/, "")}
            </li>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}
