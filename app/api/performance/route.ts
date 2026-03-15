import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getDb } from "@/lib/db";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const PERF_KEYS = ["Perf Week", "Perf Month", "Perf Quarter", "Perf Half Y", "Perf Year", "Perf YTD"] as const;
type PerfKey = typeof PERF_KEYS[number];
type PerfMap = Partial<Record<PerfKey, number | null>>;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function scrapePerf(ticker: string): Promise<PerfMap> {
  const res = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, { headers: HEADERS });
  if (!res.ok) return {};

  const $ = cheerio.load(await res.text());
  const stats: Record<string, string> = {};

  $("table.snapshot-table2 tr, table.fullview-ratings-outer tr").each((_, row) => {
    const cells = $(row).find("td");
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const key = $(cells[i]).text().trim();
      const val = $(cells[i + 1]).text().trim();
      if (key && val) stats[key] = val;
    }
  });

  const result: PerfMap = {};
  for (const k of PERF_KEYS) {
    const n = parseFloat((stats[k] ?? "").replace("%", ""));
    result[k] = isNaN(n) ? null : n;
  }
  return result;
}

export async function GET() {
  const db = getDb();

  const watchlist = db
    .prepare("SELECT ticker, price, quantity FROM watchlist")
    .all() as { ticker: string; price: string; quantity: number }[];

  if (watchlist.length === 0) {
    return NextResponse.json({ portfolio: null, spy: null, fetchedAt: null });
  }

  const tickers = [...new Set([...watchlist.map((w) => w.ticker), "SPY"])];
  const now = Date.now();
  const perfMap: Record<string, PerfMap> = {};

  const getCache = db.prepare("SELECT data, fetched_at FROM perf_cache WHERE ticker = ?");
  const upsertCache = db.prepare(`
    INSERT INTO perf_cache (ticker, data, fetched_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at
  `);

  await Promise.all(
    tickers.map(async (ticker) => {
      const row = getCache.get(ticker) as { data: string; fetched_at: string } | undefined;
      const age = row ? now - new Date(row.fetched_at + " UTC").getTime() : Infinity;

      if (row && age < CACHE_TTL_MS) {
        perfMap[ticker] = JSON.parse(row.data);
      } else {
        const perf = await scrapePerf(ticker);
        perfMap[ticker] = perf;
        upsertCache.run(ticker, JSON.stringify(perf));
      }
    })
  );

  // Value-weighted portfolio performance (falls back to equal-weight if no quantities set)
  const totalValue = watchlist.reduce(
    (sum, w) => sum + (parseFloat(w.price) || 0) * (w.quantity || 0),
    0
  );

  const portfolio: Partial<Record<PerfKey, number | null>> = {};
  for (const k of PERF_KEYS) {
    if (totalValue === 0) {
      const vals = watchlist
        .map((w) => perfMap[w.ticker]?.[k] ?? null)
        .filter((v): v is number => v !== null);
      portfolio[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    } else {
      let weighted = 0;
      let weightSum = 0;
      for (const w of watchlist) {
        const value = (parseFloat(w.price) || 0) * (w.quantity || 0);
        if (!value) continue;
        const perf = perfMap[w.ticker]?.[k] ?? null;
        if (perf === null) continue;
        weighted += perf * value;
        weightSum += value;
      }
      portfolio[k] = weightSum > 0 ? weighted / weightSum : null;
    }
  }

  // Per-ticker breakdown with weight
  const breakdown = watchlist.map((w) => {
    const value = (parseFloat(w.price) || 0) * (w.quantity || 0);
    const weight = totalValue > 0 ? (value / totalValue) * 100 : null;
    return {
      ticker: w.ticker,
      price: w.price,
      quantity: w.quantity,
      value,
      weight,
      perf: perfMap[w.ticker] ?? {},
    };
  });

  const fetchedAt = new Date().toISOString();
  return NextResponse.json({ portfolio, spy: perfMap["SPY"] ?? {}, breakdown, fetchedAt });
}
