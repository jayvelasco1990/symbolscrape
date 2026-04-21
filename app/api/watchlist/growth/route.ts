import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const TTL_MS = 6 * 60 * 60 * 1000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHistory(ticker: string): Promise<{ dates: string[]; closes: number[] } | null> {
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

    return dates.length >= 2 ? { dates, closes } : null;
  } catch {
    return null;
  }
}

interface CrossoverSignal {
  stockYtd: number;          // stock's raw YTD return %
  spyYtd: number;            // SPY's raw YTD return %
  relPerfNow: number;        // stockYtd - spyYtd
  recentCrossUp: boolean;
  daysAgoUp: number | null;
  upCrossCount: number;
  trimPct: number;
  signal: "trim" | "watch" | "hold";
  reason: string;
}

function computeCrossover(ticker: string, commonDates: string[], lookup: Record<string, Record<string, number>>, ytdStart: string): CrossoverSignal {
  // Use YTD start (first trading day of current year) as the baseline
  const startDate = commonDates.find((d) => d >= ytdStart) ?? commonDates[0];
  const ytdDates  = commonDates.filter((d) => d >= startDate);
  if (ytdDates.length < 2) {
    return { stockYtd: 0, spyYtd: 0, relPerfNow: 0, recentCrossUp: false, daysAgoUp: null, upCrossCount: 0, trimPct: 0, signal: "hold", reason: "Insufficient YTD data" };
  }

  const spyBase   = lookup["SPY"][startDate];
  const stockBase = lookup[ticker][startDate];
  const lastDate  = ytdDates[ytdDates.length - 1];

  const stockYtd = parseFloat((((lookup[ticker][lastDate] / stockBase) - 1) * 100).toFixed(2));
  const spyYtd   = parseFloat((((lookup["SPY"][lastDate]   / spyBase)   - 1) * 100).toFixed(2));

  // YTD relative performance = stockReturn - spyReturn from Jan 1
  const relPerf = ytdDates.map((d) => {
    const stockReturn = (lookup[ticker][d] / stockBase) - 1;
    const spyReturn   = (lookup["SPY"][d]   / spyBase)   - 1;
    return (stockReturn - spyReturn) * 100;
  });

  // Detect zero-crossings (upward: negative → non-negative)
  const upCrossings: number[] = [];
  for (let i = 1; i < relPerf.length; i++) {
    if (relPerf[i - 1] < 0 && relPerf[i] >= 0) upCrossings.push(i);
  }

  const relPerfNow    = relPerf[relPerf.length - 1];
  const upCrossCount  = upCrossings.length;
  const lastUpCross   = upCrossings[upCrossings.length - 1] ?? null;
  const daysAgoUp     = lastUpCross !== null ? (relPerf.length - 1 - lastUpCross) : null;
  const recentCrossUp = daysAgoUp !== null && daysAgoUp <= 15;

  // No signal if stock is still lagging SPY and no recent cross
  if (!recentCrossUp && relPerfNow < 0) {
    return { stockYtd, spyYtd, relPerfNow, recentCrossUp: false, daysAgoUp, upCrossCount, trimPct: 0, signal: "hold", reason: "Lagging SPY" };
  }

  // No recent cross and comfortably above SPY — just watch
  if (!recentCrossUp && relPerfNow > 0) {
    return { stockYtd, spyYtd, relPerfNow, recentCrossUp: false, daysAgoUp, upCrossCount, trimPct: 0, signal: "watch", reason: `+${relPerfNow.toFixed(1)}% vs SPY` };
  }

  // Recent cross — compute trim recommendation
  // Base 25% trim at any cross
  let trimPct = 25;

  // Mean reversion bonus: if it has crossed up 2+ times in the year, it tends to fall back
  if (upCrossCount >= 3) trimPct += 15;       // highly mean-reverting: trim more aggressively
  else if (upCrossCount === 2) trimPct += 8;  // moderate reversion history

  // Fresh cross bonus: act closer to the event
  if (daysAgoUp !== null && daysAgoUp <= 5)  trimPct += 10; // very fresh — highest conviction
  else if (daysAgoUp !== null && daysAgoUp <= 10) trimPct += 5;

  // Overshoot bonus: already running ahead of SPY after crossing
  if (relPerfNow > 10) trimPct += 10;
  else if (relPerfNow > 5) trimPct += 5;

  trimPct = Math.min(50, trimPct); // cap at 50%

  const reason = [
    `Crossed SPY ${daysAgoUp === 0 ? "today" : `${daysAgoUp}d ago`}`,
    upCrossCount >= 2 ? `${upCrossCount}× in past year (mean-reverting)` : null,
    relPerfNow > 0 ? `now +${relPerfNow.toFixed(1)}% vs SPY` : null,
  ].filter(Boolean).join(" · ");

  return { stockYtd, spyYtd, relPerfNow, recentCrossUp: true, daysAgoUp, upCrossCount, trimPct, signal: "trim", reason };
}

export async function GET() {
  const db = getDb();

  const watchlist = db
    .prepare("SELECT ticker, price, quantity, unit_cost FROM watchlist")
    .all() as { ticker: string; price: string; quantity: number; unit_cost: number | null }[];

  if (watchlist.length === 0) return NextResponse.json(null);

  const tickers = watchlist.map((w) => w.ticker);

  // Cache check — same tickers, Fund key present and non-zero, crossovers key present
  const cached = db
    .prepare("SELECT data, fetched_at FROM growth_cache WHERE id = 1")
    .get() as { data: string; fetched_at: string } | undefined;

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at + " UTC").getTime();
    if (age < TTL_MS) {
      const data = JSON.parse(cached.data) as {
        tickers: string[];
        chartData?: { Fund?: number }[];
        crossovers?: Record<string, CrossoverSignal>;
      };
      const sameTickers =
        data.tickers?.length === tickers.length &&
        [...tickers].sort().every((t, i) => [...(data.tickers ?? [])].sort()[i] === t);
      const midpoint  = Math.floor((data.chartData?.length ?? 0) / 2);
      const fundValid = (data.chartData?.[midpoint]?.Fund ?? 0) > 0;
      const hasCrossovers = data.crossovers != null;
      // Require stockYtd field to be present (added in this version)
      const firstCrossover = Object.values(data.crossovers ?? {})[0] as CrossoverSignal | undefined;
      const hasYtdFields = firstCrossover == null || "stockYtd" in firstCrossover;
      if (sameTickers && fundValid && hasCrossovers && hasYtdFields) return NextResponse.json(data);
    }
  }

  // Fetch sequentially to avoid Yahoo Finance rate-limiting
  const spyHistory = await fetchHistory("SPY");
  if (!spyHistory) return NextResponse.json(null);

  const stockHistories: Record<string, { dates: string[]; closes: number[] }> = {};
  for (const ticker of tickers) {
    const h = await fetchHistory(ticker);
    if (h) stockHistories[ticker] = h;
  }

  const stockTickers = tickers.filter((t) => stockHistories[t]);
  if (stockTickers.length === 0) return NextResponse.json(null);

  // Build date → price lookup
  const lookup: Record<string, Record<string, number>> = { SPY: {} };
  for (let i = 0; i < spyHistory.dates.length; i++) {
    lookup["SPY"][spyHistory.dates[i]] = spyHistory.closes[i];
  }
  for (const t of stockTickers) {
    lookup[t] = {};
    const h = stockHistories[t];
    for (let i = 0; i < h.dates.length; i++) lookup[t][h.dates[i]] = h.closes[i];
  }

  // Common dates where SPY + all stocks have prices
  const commonDates = spyHistory.dates.filter(
    (d) => lookup["SPY"][d] != null && stockTickers.every((t) => lookup[t]?.[d] != null)
  );
  if (commonDates.length < 2) return NextResponse.json(null);

  // Position weights
  const weights: Record<string, number> = {};
  let totalWeight = 0;
  for (const w of watchlist) {
    if (!stockTickers.includes(w.ticker)) continue;
    const qty  = w.quantity || 0;
    const cost = w.unit_cost && w.unit_cost > 0 ? w.unit_cost : parseFloat(w.price) || 0;
    const basis = qty > 0 && cost > 0 ? qty * cost : 0;
    weights[w.ticker] = basis;
    totalWeight += basis;
  }
  if (totalWeight === 0) {
    for (const t of stockTickers) weights[t] = 1;
    totalWeight = stockTickers.length;
  }

  const startDate = commonDates[0];

  const chartData = commonDates.map((date) => {
    let fundValue = 0;
    for (const t of stockTickers) {
      const base = lookup[t][startDate];
      const cur  = lookup[t][date];
      if (base && cur) fundValue += (weights[t] / totalWeight) * (cur / base) * 10000;
    }
    const spyBase  = lookup["SPY"][startDate];
    const spyCur   = lookup["SPY"][date];
    const spyValue = spyBase && spyCur ? (spyCur / spyBase) * 10000 : null;
    return {
      date,
      Fund: parseFloat(fundValue.toFixed(2)),
      SPY:  spyValue != null ? parseFloat(spyValue.toFixed(2)) : null,
    };
  });

  // Crossover analysis per ticker — YTD baseline (Jan 1 of current year)
  const ytdStart = `${new Date().getFullYear()}-01-01`;
  const crossovers: Record<string, CrossoverSignal> = {};
  for (const t of stockTickers) {
    crossovers[t] = computeCrossover(t, commonDates, lookup, ytdStart);
  }

  const result = { chartData, tickers, crossovers, fetchedAt: new Date().toISOString() };

  db.prepare(
    `INSERT INTO growth_cache (id, data, fetched_at) VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at`
  ).run(JSON.stringify(result));

  return NextResponse.json(result);
}
