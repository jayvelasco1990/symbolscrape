import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&enableCb=false`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
    );
    if (!res.ok) return NextResponse.json([]);
    const json = await res.json();

    const results = (json.quotes ?? [])
      .filter((r: Record<string, string>) => ["EQUITY", "ETF"].includes(r.quoteType))
      .slice(0, 8)
      .map((r: Record<string, string>) => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        type: r.quoteType,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
