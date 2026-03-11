"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SymbolSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const symbol = value.trim().toUpperCase();
    if (!symbol) return;
    setValue("");
    router.push(`/stocks/${symbol}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Symbol lookup..."
        className="h-8 w-36 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors"
      />
      <button
        type="submit"
        className="h-8 px-3 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
      >
        Go
      </button>
    </form>
  );
}
