import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getDb } from "@/lib/db";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchTenYear(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10",
      { headers: { "User-Agent": HEADERS["User-Agent"] } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    for (let i = lines.length - 1; i >= 1; i--) {
      const val = lines[i].split(",")[1]?.trim();
      if (val && val !== "." && !isNaN(parseFloat(val))) return parseFloat(val);
    }
    return null;
  } catch {
    return null;
  }
}

type RawValuation = {
  price: number | null;
  eps: number | null;
  bookSh: number | null;
  epsNextY: number | null;
};

async function scrapeValuation(ticker: string): Promise<RawValuation | null> {
  try {
    const res = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, {
      headers: { ...HEADERS, Referer: "https://finviz.com/" },
    });
    if (!res.ok) return null;

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

    const parseVal = (s: string): number | null => {
      const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
      return isNaN(n) ? null : n;
    };

    return {
      price:    parseVal(stats["Price"] ?? ""),
      eps:      parseVal(stats["EPS (ttm)"] ?? ""),
      bookSh:   parseVal(stats["Book/sh"] ?? ""),
      epsNextY: parseVal((stats["EPS Next Y"] ?? "").replace("%", "")),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const db = getDb();

  const watchlist = db
    .prepare("SELECT ticker, price, quantity FROM watchlist")
    .all() as { ticker: string; price: string; quantity: number }[];

  if (watchlist.length === 0) {
    return NextResponse.json({ items: [], tenYear: null, avgMarginOfSafety: null, fetchedAt: null });
  }

  // Reuse 10Y yield from macro_cache if fresh, otherwise fetch from FRED
  let tenYear: number | null = null;
  const macroCached = db
    .prepare("SELECT data, fetched_at FROM macro_cache WHERE id = 1")
    .get() as { data: string; fetched_at: string } | undefined;
  if (macroCached) {
    const age = Date.now() - new Date(macroCached.fetched_at + "Z").getTime();
    if (age < CACHE_TTL_MS) {
      tenYear = (JSON.parse(macroCached.data).rates?.tenYear) ?? null;
    }
  }
  if (tenYear === null) tenYear = await fetchTenYear();

  const now = Date.now();
  const getCache = db.prepare("SELECT data, fetched_at FROM valuation_cache WHERE ticker = ?");
  const upsertCache = db.prepare(`
    INSERT INTO valuation_cache (ticker, data, fetched_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at
  `);

  const items = await Promise.all(
    watchlist.map(async (w) => {
      let raw: RawValuation | null = null;
      const cached = getCache.get(w.ticker) as { data: string; fetched_at: string } | undefined;
      const age = cached ? now - new Date(cached.fetched_at + "Z").getTime() : Infinity;

      if (cached && age < CACHE_TTL_MS) {
        raw = JSON.parse(cached.data);
      } else {
        raw = await scrapeValuation(w.ticker);
        if (raw) upsertCache.run(w.ticker, JSON.stringify(raw));
      }

      if (!raw) return null;

      const { eps, bookSh, epsNextY } = raw;
      const price = raw.price ?? parseFloat(w.price) ?? null;

      // Graham Number: √(22.5 × EPS × Book/sh)
      const grahamValue =
        eps && eps > 0 && bookSh && bookSh > 0
          ? parseFloat(Math.sqrt(22.5 * eps * bookSh).toFixed(2))
          : null;

      // Revised Graham: EPS × (8.5 + 2g) × (4.4 / Y)
      // g = EPS Next Y growth %, capped at [-5, 25] to prevent wild extrapolation
      const g = epsNextY !== null ? Math.min(Math.max(epsNextY, -5), 25) : null;
      const grahamRevised =
        eps && eps > 0 && g !== null && tenYear && tenYear > 0
          ? parseFloat((eps * (8.5 + 2 * g) * (4.4 / tenYear)).toFixed(2))
          : null;

      const marginOfSafety =
        grahamValue && grahamValue > 0 && price
          ? parseFloat(((grahamValue - price) / grahamValue * 100).toFixed(1))
          : null;

      return {
        ticker: w.ticker,
        price,
        eps,
        bookSh,
        epsNextY,
        grahamValue,
        grahamRevised,
        marginOfSafety,
        quantity: w.quantity,
      };
    })
  );

  const validItems = items.filter((i): i is NonNullable<typeof i> => i !== null);

  // Portfolio-weighted average margin of safety (by position value)
  let totalWeight = 0;
  let weightedMoS = 0;
  for (const item of validItems) {
    if (item.marginOfSafety !== null && item.price && item.quantity) {
      const posValue = item.price * item.quantity;
      weightedMoS += item.marginOfSafety * posValue;
      totalWeight += posValue;
    }
  }
  const avgMarginOfSafety =
    totalWeight > 0 ? parseFloat((weightedMoS / totalWeight).toFixed(1)) : null;

  return NextResponse.json({
    items: validItems,
    tenYear,
    avgMarginOfSafety,
    fetchedAt: new Date().toISOString(),
  });
}
