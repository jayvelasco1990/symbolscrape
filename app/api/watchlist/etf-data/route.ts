import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DRIVER_ETFS = ["XOP", "JETS", "XLI", "XLY", "QQQ", "XBI", "XLE"];

async function fetchYtdAndMonth(ticker: string): Promise<{ ytd: number | null; month: number | null } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&includePrePost=false`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const dates: string[] = [];
    const closes: number[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = rawCloses[i];
      if (c == null || isNaN(c)) continue;
      dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
      closes.push(c);
    }

    if (dates.length < 2) return null;

    const lastClose = closes[closes.length - 1];

    // YTD: find first trading day of current year
    const ytdStart = `${new Date().getFullYear()}-01-01`;
    const ytdIdx = dates.findIndex((d) => d >= ytdStart);
    const ytd = ytdIdx >= 0 ? ((lastClose / closes[ytdIdx]) - 1) * 100 : null;

    // 1-month: ~21 trading days back
    const monthIdx = Math.max(0, dates.length - 22);
    const month = ((lastClose / closes[monthIdx]) - 1) * 100;

    return {
      ytd: ytd != null ? parseFloat(ytd.toFixed(2)) : null,
      month: parseFloat(month.toFixed(2)),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const db = getDb();

  // Check rs_cache for all ETFs — use the one with the most recent fetched_at
  const cached = db
    .prepare(`SELECT ticker, ytd, month, fetched_at FROM rs_cache WHERE ticker IN (${DRIVER_ETFS.map(() => "?").join(",")})`)
    .all(...DRIVER_ETFS) as { ticker: string; ytd: number | null; month: number | null; fetched_at: string }[];

  if (cached.length === DRIVER_ETFS.length) {
    const oldestFetch = cached.reduce((min, r) => {
      const t = new Date(r.fetched_at + " UTC").getTime();
      return t < min ? t : min;
    }, Infinity);
    if (Date.now() - oldestFetch < TTL_MS) {
      const result: Record<string, { ytd: number | null; month: number | null }> = {};
      for (const r of cached) result[r.ticker] = { ytd: r.ytd, month: r.month };
      return NextResponse.json(result);
    }
  }

  // Fetch sequentially to avoid rate-limiting
  const result: Record<string, { ytd: number | null; month: number | null }> = {};
  const upsert = db.prepare(
    `INSERT INTO rs_cache (ticker, ytd, month, fetched_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(ticker) DO UPDATE SET ytd=excluded.ytd, month=excluded.month, fetched_at=excluded.fetched_at`
  );

  for (const ticker of DRIVER_ETFS) {
    const data = await fetchYtdAndMonth(ticker);
    if (data) {
      result[ticker] = data;
      upsert.run(ticker, data.ytd, data.month);
    }
  }

  return NextResponse.json(result);
}
