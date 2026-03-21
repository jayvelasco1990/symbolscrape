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

async function fetchSpyAtDate(dateStr: string): Promise<number | null> {
  try {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    const period1 = Math.floor(d.getTime() / 1000) - 86400;
    const period2 = Math.floor(d.getTime() / 1000) + 7 * 86400;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&period1=${period1}&period2=${period2}`,
      { headers: { "User-Agent": HEADERS["User-Agent"] } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const closes: number[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const first = closes.filter(Boolean)[0];
    return first ? parseFloat(first.toFixed(2)) : null;
  } catch {
    return null;
  }
}

async function scrapePerf(ticker: string): Promise<{ perf: PerfMap; currentPrice: number | null }> {
  const res = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, { headers: HEADERS });
  if (!res.ok) return { perf: {}, currentPrice: null };

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

  const perf: PerfMap = {};
  for (const k of PERF_KEYS) {
    const n = parseFloat((stats[k] ?? "").replace("%", ""));
    perf[k] = isNaN(n) ? null : n;
  }

  const rawPrice = parseFloat((stats["Price"] ?? "").replace(/[^0-9.]/g, ""));
  const currentPrice = isNaN(rawPrice) ? null : rawPrice;

  return { perf, currentPrice };
}

export async function GET() {
  const db = getDb();

  const watchlist = db
    .prepare("SELECT ticker, price, quantity, unit_cost FROM watchlist")
    .all() as { ticker: string; price: string; quantity: number; unit_cost: number | null }[];

  if (watchlist.length === 0) {
    return NextResponse.json({ portfolio: null, spy: null, fetchedAt: null });
  }

  const tickers = [...new Set([...watchlist.map((w) => w.ticker), "SPY"])];
  const now = Date.now();
  const perfMap: Record<string, PerfMap> = {};
  const priceMap: Record<string, number | null> = {};

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
        const cached = JSON.parse(row.data);
        const { __price = null, ...perfData } = cached;
        perfMap[ticker] = perfData as PerfMap;
        priceMap[ticker] = __price;
      } else {
        const { perf, currentPrice } = await scrapePerf(ticker);
        perfMap[ticker] = perf;
        priceMap[ticker] = currentPrice;
        upsertCache.run(ticker, JSON.stringify({ ...perf, __price: currentPrice }));
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

  // Per-ticker breakdown with weight and unit return
  const breakdown = watchlist.map((w) => {
    const value = (parseFloat(w.price) || 0) * (w.quantity || 0);
    const weight = totalValue > 0 ? (value / totalValue) * 100 : null;
    const currentPrice = priceMap[w.ticker] ?? null;
    const unitReturn =
      w.unit_cost && w.unit_cost > 0 && currentPrice
        ? parseFloat(((currentPrice - w.unit_cost) / w.unit_cost * 100).toFixed(2))
        : null;
    return {
      ticker: w.ticker,
      price: w.price,
      quantity: w.quantity,
      unit_cost: w.unit_cost,
      currentPrice,
      value,
      weight,
      unitReturn,
      perf: perfMap[w.ticker] ?? {},
    };
  });

  // Since inception — uses MIN(added_at) as fund start date
  const inceptionRow = db
    .prepare("SELECT MIN(added_at) as inception FROM watchlist")
    .get() as { inception: string | null } | undefined;
  const inceptionDate = inceptionRow?.inception ?? null;

  let sinceInception = null;
  if (inceptionDate) {
    const spyAtInception = await fetchSpyAtDate(inceptionDate);
    const spyCurrentPrice = priceMap["SPY"] ?? null;

    // Portfolio current value using live prices (fall back to stored price)
    const portfolioCurrentValue = watchlist.reduce((sum, w) => {
      const cp = priceMap[w.ticker] ?? (parseFloat(w.price) || 0);
      return sum + cp * (w.quantity || 0);
    }, 0);

    // Cost basis: prefer unit_cost, fall back to stored price at time of adding
    const portfolioCostBasis = watchlist.reduce((sum, w) => {
      const cost = w.unit_cost && w.unit_cost > 0 ? w.unit_cost : (parseFloat(w.price) || 0);
      return sum + cost * (w.quantity || 0);
    }, 0);

    const portfolioReturn =
      portfolioCostBasis > 0
        ? parseFloat(((portfolioCurrentValue - portfolioCostBasis) / portfolioCostBasis * 100).toFixed(2))
        : null;

    const spyReturn =
      spyAtInception && spyCurrentPrice
        ? parseFloat(((spyCurrentPrice - spyAtInception) / spyAtInception * 100).toFixed(2))
        : null;

    const alpha =
      portfolioReturn !== null && spyReturn !== null
        ? parseFloat((portfolioReturn - spyReturn).toFixed(2))
        : null;

    const daysElapsed = Math.floor(
      (Date.now() - new Date(inceptionDate.replace(" ", "T") + "Z").getTime()) / (1000 * 60 * 60 * 24)
    );

    sinceInception = {
      portfolioReturn,
      spyReturn,
      alpha,
      inceptionDate,
      daysElapsed,
      hasUnitCosts: watchlist.some((w) => w.unit_cost && w.unit_cost > 0),
    };
  }

  const fetchedAt = new Date().toISOString();
  return NextResponse.json({ portfolio, spy: perfMap["SPY"] ?? {}, breakdown, sinceInception, fetchedAt });
}
