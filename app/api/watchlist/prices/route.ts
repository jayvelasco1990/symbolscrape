import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const PRICE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET() {
  const db = getDb();
  const watchlist = db.prepare("SELECT ticker FROM watchlist").all() as { ticker: string }[];
  if (watchlist.length === 0) return NextResponse.json([]);

  const now = Date.now();
  const priceByTicker: Record<string, { price: number; changePct: number }> = {};
  const needsFetch: string[] = [];

  for (const { ticker } of watchlist) {
    const cached = db
      .prepare("SELECT price, change_pct, fetched_at FROM price_cache WHERE ticker = ?")
      .get(ticker) as { price: number; change_pct: number; fetched_at: string } | undefined;
    if (cached && now - new Date(cached.fetched_at + "Z").getTime() < PRICE_TTL_MS) {
      priceByTicker[ticker] = { price: cached.price, changePct: cached.change_pct };
    } else {
      needsFetch.push(ticker);
    }
  }

  if (needsFetch.length > 0) {
    const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
    const upsert = db.prepare(
      `INSERT INTO price_cache (ticker, price, change_pct, fetched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(ticker) DO UPDATE SET price = excluded.price, change_pct = excluded.change_pct, fetched_at = excluded.fetched_at`
    );

    await Promise.all(
      needsFetch.map(async (ticker) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d&includePrePost=false`,
            { headers: { "User-Agent": UA } }
          );
          if (!res.ok) return;
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (!meta) return;
          const price: number = meta.regularMarketPrice;
          const prevClose: number = meta.previousClose ?? meta.chartPreviousClose;
          if (!price || !prevClose) return;
          const changePct = ((price - prevClose) / prevClose) * 100;
          priceByTicker[ticker] = { price, changePct };
          upsert.run(ticker, price, changePct, fetched_at);
        } catch { /* silent */ }
      })
    );
  }

  return NextResponse.json(
    watchlist.map(({ ticker }) => ({
      ticker,
      price: priceByTicker[ticker]?.price ?? null,
      changePct: priceByTicker[ticker]?.changePct ?? null,
    }))
  );
}
