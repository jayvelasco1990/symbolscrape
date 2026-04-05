import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RANGE_CONFIG: Record<string, { range: string; interval: string }> = {
  ytd: { range: "ytd", interval: "1d" },
  "1y": { range: "1y",  interval: "1d" },
  "3y": { range: "3y",  interval: "1wk" },
  "5y": { range: "5y",  interval: "1wk" },
};

async function fetchPrices(symbol: string, range: string, interval: string): Promise<{ date: string; close: number }[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split("T")[0],
        close: closes[i] ?? null,
      }))
      .filter((d): d is { date: string; close: number } => d.close != null);
  } catch {
    return [];
  }
}

function computeSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

interface ChartStats {
  vol: number | null;
  maxDrawdown: number | null;
  beta: number | null;
  sharpe: number | null;
}

function computeStats(tickerCloses: number[], spyCloses: number[]): ChartStats {
  if (tickerCloses.length < 10) return { vol: null, maxDrawdown: null, beta: null, sharpe: null };

  // Daily/weekly log returns
  const returns = tickerCloses.slice(1).map((c, i) => Math.log(c / tickerCloses[i]));
  const spyReturns = spyCloses.slice(1).map((c, i) => Math.log(c / spyCloses[i]));

  // Annualized volatility (252 trading days or 52 weeks)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const annFactor = returns.length > 60 ? 252 : 52; // weekly vs daily
  const vol = parseFloat((Math.sqrt(variance * annFactor) * 100).toFixed(1));

  // Max drawdown
  let peak = tickerCloses[0];
  let maxDD = 0;
  for (const c of tickerCloses) {
    if (c > peak) peak = c;
    const dd = (c - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const maxDrawdown = parseFloat((maxDD * 100).toFixed(1));

  // Beta vs SPY (align lengths)
  let beta: number | null = null;
  const n = Math.min(returns.length, spyReturns.length);
  if (n >= 10) {
    const rSlice = returns.slice(-n);
    const sSlice = spyReturns.slice(-n);
    const spyMean = sSlice.reduce((a, b) => a + b, 0) / n;
    const rMean   = rSlice.reduce((a, b) => a + b, 0) / n;
    const cov     = rSlice.reduce((a, b, i) => a + (b - rMean) * (sSlice[i] - spyMean), 0) / n;
    const spyVar  = sSlice.reduce((a, b) => a + (b - spyMean) ** 2, 0) / n;
    if (spyVar !== 0) beta = parseFloat((cov / spyVar).toFixed(2));
  }

  // Sharpe ratio (annualized return vs 4.5% risk-free)
  const totalReturn = (tickerCloses[tickerCloses.length - 1] / tickerCloses[0] - 1) * 100;
  const annReturn   = totalReturn * (annFactor / tickerCloses.length);
  const sharpe      = vol > 0 ? parseFloat(((annReturn - 4.5) / vol).toFixed(2)) : null;

  return { vol, maxDrawdown, beta, sharpe };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const range = req.nextUrl.searchParams.get("range") ?? "1y";
  const cfg = RANGE_CONFIG[range] ?? RANGE_CONFIG["1y"];

  const [tickerPrices, spyPrices] = await Promise.all([
    fetchPrices(symbol, cfg.range, cfg.interval),
    fetchPrices("SPY",  cfg.range, cfg.interval),
  ]);

  if (!tickerPrices.length) {
    return NextResponse.json({ points: [], stats: null });
  }

  const tickerCloses = tickerPrices.map((d) => d.close);
  const spyCloses    = spyPrices.map((d) => d.close);

  // Compute SMAs on raw closes, then index to 100 at period start
  const sma50Raw  = computeSMA(tickerCloses, 50);
  const sma200Raw = computeSMA(tickerCloses, 200);
  const base      = tickerCloses[0];
  const spyBase   = spyCloses.length > 0 ? spyCloses[0] : null;
  const spyMap    = new Map(spyPrices.map((d) => [d.date, d.close]));

  const points = tickerPrices.map((d, i) => {
    const spyClose = spyMap.get(d.date) ?? null;
    return {
      date:   d.date,
      ticker: parseFloat(((d.close / base) * 100).toFixed(2)),
      spy:    spyClose != null && spyBase != null
        ? parseFloat(((spyClose / spyBase) * 100).toFixed(2))
        : null,
      sma50:  sma50Raw[i]  != null ? parseFloat(((sma50Raw[i]!  / base) * 100).toFixed(2)) : null,
      sma200: sma200Raw[i] != null ? parseFloat(((sma200Raw[i]! / base) * 100).toFixed(2)) : null,
    };
  });

  const stats = computeStats(tickerCloses, spyCloses);

  return NextResponse.json({ points, symbol, range, stats });
}
