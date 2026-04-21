import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const TTL_MS = 6 * 60 * 60 * 1000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SPY_LONG_RUN_CAGR = 10.0; // S&P 500 historical avg (%)

async function fetchAnnualReturn(ticker: string): Promise<{ cagr1y: number | null; startPrice: number | null; endPrice: number | null }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&includePrePost=false`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return { cagr1y: null, startPrice: null, endPrice: null };
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return { cagr1y: null, startPrice: null, endPrice: null };

    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
      (c: unknown): c is number => typeof c === "number" && !isNaN(c)
    );
    if (closes.length < 20) return { cagr1y: null, startPrice: null, endPrice: null };

    const startPrice = closes[0];
    const endPrice   = closes[closes.length - 1];
    const years      = closes.length / 252;
    const cagr1y     = parseFloat((((endPrice / startPrice) ** (1 / years) - 1) * 100).toFixed(2));
    return { cagr1y, startPrice, endPrice };
  } catch {
    return { cagr1y: null, startPrice: null, endPrice: null };
  }
}

function projectValue(start: number, cagrPct: number, years: number): number {
  return parseFloat((start * (1 + cagrPct / 100) ** years).toFixed(2));
}

export async function GET() {
  const db = getDb();

  const watchlist = db
    .prepare("SELECT ticker, price, quantity, unit_cost FROM watchlist")
    .all() as { ticker: string; price: string; quantity: number; unit_cost: number | null }[];

  if (watchlist.length === 0) return NextResponse.json(null);

  const tickers = watchlist.map((w) => w.ticker);

  // Cache stored in perf_cache under __projection__ key
  const cached = db
    .prepare("SELECT data, fetched_at FROM perf_cache WHERE ticker = '__projection__'")
    .get() as { data: string; fetched_at: string } | undefined;

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at + " UTC").getTime();
    if (age < TTL_MS) {
      const data = JSON.parse(cached.data) as { tickers: string[]; positions: { cagr1y?: number }[] };
      const sameTickers =
        data.tickers?.length === tickers.length &&
        [...tickers].sort().every((t, i) => [...(data.tickers ?? [])].sort()[i] === t);
      const hasNewFormat = "cagr1y" in (data.positions?.[0] ?? {});
      if (sameTickers && hasNewFormat) return NextResponse.json(data);
    }
  }

  // Fetch 1Y annualized returns for all positions + SPY
  const allTickers = [...new Set([...tickers, "SPY"])];
  const rawReturns = await Promise.all(allTickers.map(fetchAnnualReturn));
  const returnMap  = Object.fromEntries(allTickers.map((t, i) => [t, rawReturns[i]]));

  // Position weights — cost basis preferred, then price×qty, then equal
  let totalBasis = 0;
  const posData = watchlist.map((w) => {
    const qty  = w.quantity || 0;
    const cost = w.unit_cost && w.unit_cost > 0 ? w.unit_cost : parseFloat(w.price) || 0;
    const basis = qty > 0 && cost > 0 ? qty * cost : 0;
    totalBasis += basis;
    return { ticker: w.ticker, basis };
  });

  if (totalBasis === 0) {
    posData.forEach((p) => { p.basis = 1; });
    totalBasis = posData.length;
  }

  const positions = posData.map((p) => {
    const r      = returnMap[p.ticker];
    const weight = (p.basis / totalBasis) * 100;
    return {
      ticker:       p.ticker,
      cagr1y:       r.cagr1y,
      startPrice:   r.startPrice,
      endPrice:     r.endPrice,
      weight:       parseFloat(weight.toFixed(1)),
      contribution: r.cagr1y != null
        ? parseFloat((r.cagr1y * (p.basis / totalBasis)).toFixed(2))
        : null,
    };
  });

  // Blended portfolio CAGR — scale to weight covered by available data
  const withData      = positions.filter((p) => p.contribution !== null);
  const weightCovered = withData.reduce((s, p) => s + p.weight, 0);
  const rawCAGR       = withData.reduce((s, p) => s + p.contribution!, 0);
  const portfolioCAGR = weightCovered > 0
    ? parseFloat((rawCAGR * (100 / weightCovered)).toFixed(2))
    : null;

  if (portfolioCAGR === null) return NextResponse.json(null);

  // SPY: use actual 1Y CAGR from price history, fall back to long-run avg
  const spyCagr = returnMap["SPY"]?.cagr1y ?? SPY_LONG_RUN_CAGR;

  const scenarios = {
    bull: parseFloat((portfolioCAGR * 1.3).toFixed(2)),
    base: portfolioCAGR,
    bear: parseFloat((portfolioCAGR * 0.5).toFixed(2)),
    spy:  spyCagr,
  };

  const chartData = Array.from({ length: 6 }, (_, t) => ({
    year: t === 0 ? "Today" : `Year ${t}`,
    Bull: projectValue(10000, scenarios.bull, t),
    Base: projectValue(10000, scenarios.base, t),
    Bear: projectValue(10000, scenarios.bear, t),
    SPY:  projectValue(10000, scenarios.spy,  t),
  }));

  const result = { portfolioCAGR, scenarios, positions, chartData, tickers, spyCagr, fetchedAt: new Date().toISOString() };

  db.prepare(`
    INSERT INTO perf_cache (ticker, data, fetched_at) VALUES ('__projection__', ?, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at
  `).run(JSON.stringify(result));

  return NextResponse.json(result);
}
