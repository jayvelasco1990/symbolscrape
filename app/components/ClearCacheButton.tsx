"use client";

import { useState } from "react";

export default function ClearCacheButton() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleClick() {
    setState("loading");
    try {
      await fetch("/api/cache", { method: "DELETE" });
      setState("done");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
    >
      {state === "loading" ? "Clearing…" : state === "done" ? "✓ Cleared" : "Clear cache"}
    </button>
  );
}
