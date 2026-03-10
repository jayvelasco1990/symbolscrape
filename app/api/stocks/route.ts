import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const SCREENERS: Record<string, string> = {
  megacap:
    "https://finviz.com/screener.ashx?v=111&f=cap_mega%2Cfa_div_pos%2Cta_beta_u1%2Cta_rsi_nob50&ft=3",
  largecap:
    "https://finviz.com/screener.ashx?v=111&f=cap_large,fa_div_pos,geo_usa,ta_beta_u1,ta_rsi_nob50&o=pe",
};

export async function GET(request: NextRequest) {
  const screener = request.nextUrl.searchParams.get("screener") ?? "megacap";
  const r = request.nextUrl.searchParams.get("r") ?? "1";
  const baseUrl = SCREENERS[screener] ?? SCREENERS.megacap;
  const url = `${baseUrl}&r=${r}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Failed to fetch Finviz: ${res.status}` },
      { status: 502 }
    );
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const headers: string[] = [];
  $("table.screener_table thead tr th").each((_, el) => {
    headers.push($(el).text().trim());
  });

  const rows: Record<string, string>[] = [];
  $("table.screener_table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length === 0) return;
    const entry: Record<string, string> = {};
    cells.each((i, cell) => {
      const key = headers[i] ?? `col_${i}`;
      entry[key] = $(cell).text().trim();
    });
    rows.push(entry);
  });

  return NextResponse.json({ headers, rows });
}
