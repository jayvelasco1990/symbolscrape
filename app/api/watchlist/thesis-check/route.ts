import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getDb } from "@/lib/db";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://finviz.com/",
};
const TTL_MS = 6 * 60 * 60 * 1000;

type ThesisStatus = "intact" | "watch" | "broken";

interface ThesisSignal {
  level: "watch" | "broken";
  reason: string;
}

interface TickerMetrics {
  signal: string;
  moatScore: number;
  debtToEbitda: number;
  debtToRevenue: number;
  revenueGrowthPct: number;
  fcfMarginPct: number;
  insiderTrend: string;
  netCashPerShare: number;
}

function parseVal(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseFormatted(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!n) return 0;
  if (s.includes("T")) return n * 1e12;
  if (s.includes("B")) return n * 1e9;
  if (s.includes("M")) return n * 1e6;
  return n;
}

async function scrapeFinvizStats(ticker: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`https://finviz.com/quote.ashx?t=${ticker}`, { headers: HEADERS });
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
    return Object.keys(stats).length > 0 ? stats : null;
  } catch { return null; }
}

function computeMetrics(stats: Record<string, string>, signal: string): TickerMetrics {
  const roe          = parseVal(stats["ROE"]           ?? "");
  const roic         = parseVal(stats["ROIC"]          ?? "");
  const profitMargin = parseVal(stats["Profit Margin"] ?? "");

  let moatScore = 0;
  if (roe > 20)          moatScore += 2; else if (roe >= 12)         moatScore += 1;
  if (roic > 15)         moatScore += 2; else if (roic >= 8)         moatScore += 1;
  if (profitMargin > 15) moatScore += 2; else if (profitMargin >= 8) moatScore += 1;

  const debtEq      = parseVal(stats["Debt/Eq"]        ?? "");
  const bookSh      = parseVal(stats["Book/sh"]        ?? "");
  const shsOut      = parseFormatted(stats["Shs Outstand"] ?? "");
  const totalDebt   = debtEq * bookSh * shsOut;
  const sales       = parseFormatted(stats["Sales"]    ?? "");
  const ev          = parseFormatted(stats["Enterprise Value"] ?? "");
  const evEbitda    = parseVal(stats["EV/EBITDA"]      ?? "");
  const ebitda      = ev && evEbitda ? ev / evEbitda : 0;

  const debtToEbitda  = totalDebt && ebitda ? totalDebt / ebitda : 0;
  const debtToRevenue = totalDebt && sales  ? totalDebt / sales  : 0;

  const salesQQ   = parseVal(stats["Sales Q/Q"] ?? "");
  const price     = parseVal(stats["Price"]     ?? "");
  const pfcf      = parseVal(stats["P/FCF"]     ?? "");
  const fcfSh     = price && pfcf ? price / pfcf : 0;
  const fcfTotal  = fcfSh && shsOut ? fcfSh * shsOut : 0;
  const fcfMargin = fcfTotal && sales ? (fcfTotal / sales) * 100 : 0;

  const cashSh       = parseVal(stats["Cash/sh"] ?? "");
  const netCashPerSh = cashSh - debtEq * bookSh;

  const transRaw    = stats["Insider Trans"] ?? "";
  const transN      = parseVal(transRaw);
  const trans       = transRaw.trim().startsWith("-") ? -Math.abs(transN) : transN;
  const insiderTrend = trans > 1 ? "Buying" : trans < -1 ? "Selling" : "Neutral";

  return {
    signal,
    moatScore,
    debtToEbitda,
    debtToRevenue,
    revenueGrowthPct: salesQQ,
    fcfMarginPct: fcfMargin,
    insiderTrend,
    netCashPerShare: netCashPerSh,
  };
}

function evaluateThesis(m: TickerMetrics): { status: ThesisStatus; flags: ThesisSignal[]; summary: string } {
  const flags: ThesisSignal[] = [];

  // Value signal
  if (m.signal === "Avoid")
    flags.push({ level: "broken", reason: "Graham signal flipped to Avoid" });
  else if (m.signal === "Neutral")
    flags.push({ level: "watch", reason: "Graham signal weakened to Neutral" });

  // Moat quality
  if (m.moatScore < 2)
    flags.push({ level: "broken", reason: "Moat quality collapsed (score < 2/6)" });
  else if (m.moatScore <= 2)
    flags.push({ level: "watch", reason: "Moat quality narrowing (score ≤ 2/6)" });

  // Leverage
  if (m.debtToEbitda > 5)
    flags.push({ level: "broken", reason: `Debt/EBITDA ${m.debtToEbitda.toFixed(1)}x — dangerously high` });
  else if (m.debtToEbitda > 3)
    flags.push({ level: "watch", reason: `Debt/EBITDA ${m.debtToEbitda.toFixed(1)}x — elevated` });

  if (m.debtToRevenue > 3)
    flags.push({ level: "broken", reason: `Debt/Revenue ${m.debtToRevenue.toFixed(1)}x — excessive` });
  else if (m.debtToRevenue > 1.5)
    flags.push({ level: "watch", reason: `Debt/Revenue ${m.debtToRevenue.toFixed(1)}x — high` });

  // Revenue growth
  if (m.revenueGrowthPct < -10)
    flags.push({ level: "broken", reason: `Revenue declining ${m.revenueGrowthPct.toFixed(1)}% QoQ` });
  else if (m.revenueGrowthPct < 0)
    flags.push({ level: "watch", reason: `Revenue growth stalling (${m.revenueGrowthPct.toFixed(1)}%)` });

  // FCF
  if (m.fcfMarginPct < -15)
    flags.push({ level: "broken", reason: `FCF margin deeply negative (${m.fcfMarginPct.toFixed(1)}%)` });
  else if (m.fcfMarginPct < 0)
    flags.push({ level: "watch", reason: `FCF margin negative (${m.fcfMarginPct.toFixed(1)}%)` });

  // Net cash
  if (m.netCashPerShare < -50)
    flags.push({ level: "broken", reason: "Net cash deeply negative — debt-heavy balance sheet" });

  // Insider activity
  if (m.insiderTrend === "Selling")
    flags.push({ level: "watch", reason: "Insiders net selling over past 6 months" });

  const brokenFlags = flags.filter(f => f.level === "broken");
  const watchFlags  = flags.filter(f => f.level === "watch");

  let status: ThesisStatus;
  if (brokenFlags.length >= 2)      status = "broken";
  else if (brokenFlags.length === 1) status = "watch";
  else if (watchFlags.length >= 2)   status = "watch";
  else if (flags.length > 0)         status = "watch";
  else                               status = "intact";

  const summary =
    status === "intact" ? "All key metrics healthy — thesis supported by data" :
    status === "watch"  ? `${flags.length} concern${flags.length > 1 ? "s" : ""} — monitor closely` :
                          `${brokenFlags.length} critical flag${brokenFlags.length > 1 ? "s" : ""} — consider exiting`;

  return { status, flags, summary };
}

export async function GET() {
  const db = getDb();
  const watchlist = db.prepare("SELECT ticker FROM watchlist").all() as { ticker: string }[];
  if (watchlist.length === 0) return NextResponse.json([]);

  const now = Date.now();
  const signalMap: Record<string, string> = {};

  // Load cached Graham signals
  for (const { ticker } of watchlist) {
    const cached = db
      .prepare("SELECT signal FROM signal_cache WHERE ticker = ?")
      .get(ticker) as { signal: string } | undefined;
    signalMap[ticker] = cached?.signal ?? "No Data";
  }

  const results = await Promise.all(
    watchlist.map(async ({ ticker }) => {
      // Check thesis_cache first
      const cached = db
        .prepare("SELECT data, fetched_at FROM thesis_cache WHERE ticker = ?")
        .get(ticker) as { data: string; fetched_at: string } | undefined;

      if (cached && now - new Date(cached.fetched_at + "Z").getTime() < TTL_MS) {
        return { ticker, ...JSON.parse(cached.data) };
      }

      const stats = await scrapeFinvizStats(ticker);
      if (!stats) return { ticker, status: "intact", flags: [], summary: "No data available" };

      const metrics  = computeMetrics(stats, signalMap[ticker] ?? "No Data");
      const { status, flags, summary } = evaluateThesis(metrics);
      const payload  = { status, flags, summary, metrics };

      const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
      db.prepare(
        `INSERT INTO thesis_cache (ticker, data, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(ticker) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`
      ).run(ticker, JSON.stringify(payload), fetched_at);

      return { ticker, ...payload };
    })
  );

  return NextResponse.json(results);
}
