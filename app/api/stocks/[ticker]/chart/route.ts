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
    return NextResponse.json({ points: [] });
  }

  // Align on dates present in ticker data; match SPY by nearest date
  const spyMap = new Map(spyPrices.map((d) => [d.date, d.close]));

  // Normalize both to 100 at the first data point for easy comparison
  const base = tickerPrices[0].close;
  const spyBase = spyPrices.length > 0 ? spyPrices[0].close : null;

  const points = tickerPrices.map((d) => {
    const spyClose = spyMap.get(d.date) ?? null;
    return {
      date: d.date,
      ticker: parseFloat(((d.close / base) * 100).toFixed(2)),
      spy: spyClose != null && spyBase != null
        ? parseFloat(((spyClose / spyBase) * 100).toFixed(2))
        : null,
    };
  });

  return NextResponse.json({ points, symbol, range });
}
