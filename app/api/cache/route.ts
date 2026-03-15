import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE() {
  const db = getDb();

  const signals = db.prepare("DELETE FROM signal_cache").run();
  const perf    = db.prepare("DELETE FROM perf_cache").run();
  const macro   = db.prepare("DELETE FROM macro_cache").run();

  return NextResponse.json({
    cleared: {
      signals: signals.changes,
      performance: perf.changes,
      macro: macro.changes,
    },
  });
}
