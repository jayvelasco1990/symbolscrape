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

const INDEX_ETFS = [
  { symbol: "SPY",  name: "S&P 500" },
  { symbol: "QQQ",  name: "Nasdaq 100" },
  { symbol: "DIA",  name: "Dow Jones" },
  { symbol: "IWM",  name: "Russell 2000" },
  { symbol: "EFA",  name: "Intl Developed" },
  { symbol: "EEM",  name: "Emerging Mkts" },
];

const SECTOR_ETFS = [
  { symbol: "XLK",  name: "Technology",    subsectors: [{ symbol: "SOXX", name: "Semiconductors" }, { symbol: "IGV",  name: "Software" },         { symbol: "HACK", name: "Cybersecurity" }] },
  { symbol: "XLF",  name: "Financials",    subsectors: [{ symbol: "KRE",  name: "Regional Banks" }, { symbol: "IAI",  name: "Broker-Dealers" }] },
  { symbol: "XLV",  name: "Health Care",   subsectors: [{ symbol: "XBI",  name: "Biotech" },        { symbol: "IHI",  name: "Med Devices" }] },
  { symbol: "XLE",  name: "Energy",        subsectors: [{ symbol: "OIH",  name: "Oil Services" },   { symbol: "XOP",  name: "E&P" }] },
  { symbol: "XLU",  name: "Utilities",     subsectors: [{ symbol: "ICLN", name: "Clean Energy" }] },
  { symbol: "XLI",  name: "Industrials",   subsectors: [{ symbol: "ITA",  name: "Aerospace & Defense" }, { symbol: "JETS", name: "Airlines" }] },
  { symbol: "XLP",  name: "Cons. Staples", subsectors: [{ symbol: "PBJ",  name: "Food & Beverage" }] },
  { symbol: "XLY",  name: "Cons. Disc.",   subsectors: [{ symbol: "XRT",  name: "Retail" },          { symbol: "BETZ", name: "Gaming & Leisure" }] },
  { symbol: "XLB",  name: "Materials",     subsectors: [{ symbol: "GDX",  name: "Gold Miners" },     { symbol: "COPX", name: "Copper Miners" }] },
  { symbol: "XLRE", name: "Real Estate",   subsectors: [{ symbol: "REZ",  name: "Residential REITs" }, { symbol: "SRVR", name: "Data Centers" }] },
  { symbol: "XLC",  name: "Comm. Svcs",    subsectors: [{ symbol: "SOCL", name: "Social Media" }] },
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

interface EtfData {
  symbol: string;
  name: string;
  price: string;
  perfWeek: number | null;
  perfMonth: number | null;
  perfYTD: number | null;
  sma200: number | null;
}

async function fetchYahooEtfData(symbol: string, name: string): Promise<EtfData> {
  const empty: EtfData = { symbol, name, price: "", perfWeek: null, perfMonth: null, perfYTD: null, sma200: null };
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y&includePrePost=false`,
      { headers: { "User-Agent": HEADERS["User-Agent"] } }
    );
    if (!res.ok) return empty;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return empty;

    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const timestamps: number[] = result.timestamp ?? [];

    const lastValidIdx = closes.reduce((best, c, i) => (c != null ? i : best), -1);
    if (lastValidIdx < 0) return empty;
    const last = closes[lastValidIdx] as number;

    // Calendar-aligned performance (matches Finviz convention)
    const now = new Date();
    const yearStart  = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
    const daysToMon  = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMon).getTime() / 1000;

    const closeAt = (target: number): number | null => {
      const idx = timestamps.findIndex((t) => t >= target);
      return idx >= 0 ? (closes[idx] ?? null) : (closes[0] ?? null);
    };

    const pct = (a: number | null, b: number | null) =>
      a != null && b != null && b !== 0
        ? parseFloat(((a / b - 1) * 100).toFixed(2))
        : null;

    // SMA200: average of last 200 valid closes
    const validCloses = closes.filter((c): c is number => c != null);
    const last200 = validCloses.slice(-200);
    const sma200Price = last200.length >= 20 ? last200.reduce((a, b) => a + b, 0) / last200.length : null;

    return {
      symbol,
      name,
      price: last.toFixed(2),
      perfWeek:  pct(last, closeAt(weekStart)),
      perfMonth: pct(last, closeAt(monthStart)),
      perfYTD:   pct(last, closeAt(yearStart)),
      sma200:    pct(last, sma200Price),
    };
  } catch {
    return empty;
  }
}

function parseNum(s: string | undefined): number | null {
  if (!s || s === "-") return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function toEtfData(stats: Record<string, string> | null, symbol: string, name: string) {
  return {
    symbol,
    name,
    price: stats?.["Price"] ?? "",
    perfWeek: parseNum(stats?.["Perf Week"]),
    perfMonth: parseNum(stats?.["Perf Month"]),
    perfYTD: parseNum(stats?.["Perf YTD"]),
    sma200: parseNum(stats?.["SMA200"]),
  };
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
      if (parsed.sectors?.[0]?.rateRisk !== undefined && parsed.indexes !== undefined) {
        return NextResponse.json({ ...parsed, cached: true, fetchedAt: cached.fetched_at });
      }
    }
  }

  const allSubsectorEtfs = SECTOR_ETFS.flatMap((s) => s.subsectors);

  // Finviz for indexes + sectors (~17 requests), Yahoo for subsectors (~13 requests) — run concurrently
  const [[dgs10, dgs2, fedFunds, igSpread, hySpread, vix], finvizResults, subsectorData] =
    await Promise.all([
      Promise.all([
        fetchFredSeries("DGS10"),
        fetchFredSeries("DGS2"),
        fetchFredSeries("FEDFUNDS"),
        fetchFredSeries("BAMLC0A0CM"),
        fetchFredSeries("BAMLH0A0HYM2"),
        fetchVix(),
      ]),
      Promise.all([
        ...INDEX_ETFS.map((e) => scrapeFinvizStats(e.symbol)),
        ...SECTOR_ETFS.map((e) => scrapeFinvizStats(e.symbol)),
      ]),
      Promise.all(allSubsectorEtfs.map((e) => fetchYahooEtfData(e.symbol, e.name))),
    ]);

  const indexResults  = finvizResults.slice(0, INDEX_ETFS.length);
  const sectorResults = finvizResults.slice(INDEX_ETFS.length);

  // SPY is always the first index
  const spyStats = indexResults[0];
  const spySma200 = parseNum(spyStats?.["SMA200"]);
  const spyAboveMA200 = spySma200 != null && spySma200 > 0;

  const yieldCurve =
    dgs10 != null && dgs2 != null
      ? parseFloat((dgs10 - dgs2).toFixed(2))
      : null;

  let regime: "risk-on" | "neutral" | "risk-off" = "neutral";
  if (vix != null && spySma200 != null) {
    if (vix < 18 && spyAboveMA200) regime = "risk-on";
    else if (vix > 25 || spySma200 < -5) regime = "risk-off";
  }

  const indexes = INDEX_ETFS.map((etf, i) => toEtfData(indexResults[i], etf.symbol, etf.name));

  let subOffset = 0;
  const sectors = SECTOR_ETFS.map((etf, i) => {
    const risk = computeRiskProfile(etf.name);
    const subsectors = etf.subsectors.map((_, j) => subsectorData[subOffset + j]);
    subOffset += etf.subsectors.length;
    return {
      ...toEtfData(sectorResults[i], etf.symbol, etf.name),
      rateRisk: computeRateSensitivity(etf.name),
      climateRisk: risk.climate,
      subsectors,
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
    indexes,
    sectors,
  };

  const now = new Date().toISOString().replace("T", " ").split(".")[0];
  db.prepare(
    `INSERT INTO macro_cache (id, data, fetched_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`
  ).run(JSON.stringify(data), now);

  return NextResponse.json({ ...data, cached: false, fetchedAt: now });
}
