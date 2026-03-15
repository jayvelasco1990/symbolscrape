import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getDb } from "@/lib/db";
import { computeRiskProfile, computeRateSensitivity } from "@/lib/riskScores";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const SECTOR_ETFS = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLV", name: "Health Care" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLP", name: "Cons. Staples" },
  { symbol: "XLY", name: "Cons. Disc." },
  { symbol: "XLB", name: "Materials" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLC", name: "Comm. Svcs" },
];

async function fetchFredSeries(id: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`,
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

async function fetchVix(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d",
      { headers: { "User-Agent": HEADERS["User-Agent"] } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const closes: number[] =
      json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const last = closes.filter(Boolean).pop();
    return last != null ? parseFloat(last.toFixed(2)) : null;
  } catch {
    return null;
  }
}

async function scrapeFinvizStats(
  symbol: string
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`https://finviz.com/quote.ashx?t=${symbol}`, {
      headers: { ...HEADERS, Referer: "https://finviz.com/" },
    });
    if (!res.ok) return null;
    const $ = cheerio.load(await res.text());
    const stats: Record<string, string> = {};
    $("table.snapshot-table2 tr, table.fullview-ratings-outer tr").each(
      (_, row) => {
        const cells = $(row).find("td");
        for (let i = 0; i + 1 < cells.length; i += 2) {
          const key = $(cells[i]).text().trim();
          const val = $(cells[i + 1]).text().trim();
          if (key && val) stats[key] = val;
        }
      }
    );
    return Object.keys(stats).length > 0 ? stats : null;
  } catch {
    return null;
  }
}

function parseNum(s: string | undefined): number | null {
  if (!s || s === "-") return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

export async function GET() {
  const db = getDb();

  const cached = db
    .prepare("SELECT data, fetched_at FROM macro_cache WHERE id = 1")
    .get() as { data: string; fetched_at: string } | undefined;

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at + "Z").getTime();
    if (age < CACHE_TTL_MS) {
      const parsed = JSON.parse(cached.data);
      // Invalidate cache if it predates rateRisk field (schema migration)
      if (parsed.sectors?.[0]?.rateRisk !== undefined) {
        return NextResponse.json({ ...parsed, cached: true, fetchedAt: cached.fetched_at });
      }
    }
  }

  const [dgs10, dgs2, fedFunds, igSpread, hySpread, vix, spyStats, ...sectorResults] =
    await Promise.all([
      fetchFredSeries("DGS10"),
      fetchFredSeries("DGS2"),
      fetchFredSeries("FEDFUNDS"),
      fetchFredSeries("BAMLC0A0CM"),
      fetchFredSeries("BAMLH0A0HYM2"),
      fetchVix(),
      scrapeFinvizStats("SPY"),
      ...SECTOR_ETFS.map((e) => scrapeFinvizStats(e.symbol)),
    ]);

  const yieldCurve =
    dgs10 != null && dgs2 != null
      ? parseFloat((dgs10 - dgs2).toFixed(2))
      : null;

  const spySma200 = parseNum(spyStats?.["SMA200"]);
  const spyAboveMA200 = spySma200 != null && spySma200 > 0;

  let regime: "risk-on" | "neutral" | "risk-off" = "neutral";
  if (vix != null && spySma200 != null) {
    if (vix < 18 && spyAboveMA200) regime = "risk-on";
    else if (vix > 25 || spySma200 < -5) regime = "risk-off";
  }

  const sectors = SECTOR_ETFS.map((etf, i) => {
    const s = sectorResults[i];
    const risk = computeRiskProfile(etf.name);
    return {
      symbol: etf.symbol,
      name: etf.name,
      price: s?.["Price"] ?? "",
      perfWeek: parseNum(s?.["Perf Week"]),
      perfMonth: parseNum(s?.["Perf Month"]),
      perfYTD: parseNum(s?.["Perf YTD"]),
      sma200: parseNum(s?.["SMA200"]),
      rateRisk: computeRateSensitivity(etf.name),
      climateRisk: risk.climate,
    };
  });

  const data = {
    regime,
    vix,
    rates: {
      tenYear: dgs10,
      twoYear: dgs2,
      fedFunds,
      yieldCurve,
      isInverted: yieldCurve != null && yieldCurve < 0,
    },
    spreads: { ig: igSpread, hy: hySpread },
    spy: {
      price: spyStats?.["Price"] ?? "",
      sma200: spySma200,
      aboveMA200: spyAboveMA200,
      perfWeek: parseNum(spyStats?.["Perf Week"]),
      perfMonth: parseNum(spyStats?.["Perf Month"]),
      perfYTD: parseNum(spyStats?.["Perf YTD"]),
    },
    sectors,
  };

  const now = new Date().toISOString().replace("T", " ").split(".")[0];
  db.prepare(
    `INSERT INTO macro_cache (id, data, fetched_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`
  ).run(JSON.stringify(data), now);

  return NextResponse.json({ ...data, cached: false, fetchedAt: now });
}
