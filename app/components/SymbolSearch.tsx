"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface Suggestion {
  symbol: string;
  name: string;
  type: string;
}

export default function SymbolSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setHighlighted(-1);
        setOpen(data.length > 0);
      } catch {
        // silently fail — user can still type exact ticker and press Enter
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function navigate(symbol: string) {
    setValue("");
    setSuggestions([]);
    setOpen(false);
    router.push(`/stocks/${symbol.toUpperCase()}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && suggestions[highlighted]) {
        navigate(suggestions[highlighted].symbol);
      } else {
        const sym = value.trim();
        if (sym) navigate(sym);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Search ticker or company…"
        className="h-8 w-52 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:focus:ring-indigo-600 transition-colors"
      />

      {open && (
        <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.symbol}
              onMouseDown={() => navigate(s.symbol)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                highlighted === i
                  ? "bg-indigo-50 dark:bg-indigo-950/50"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 w-14 shrink-0">
                {s.symbol}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex-1">
                {s.name}
              </span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                s.type === "ETF"
                  ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              }`}>
                {s.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
