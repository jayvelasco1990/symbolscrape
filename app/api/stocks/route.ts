import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const FINVIZ_URL =
  "https://finviz.com/screener.ashx?v=111&f=cap_mega%2Cfa_div_pos%2Cta_beta_u1%2Cta_rsi_nob50&ft=3";

export async function GET() {
  const res = await fetch(FINVIZ_URL, {
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

  // Parse header row
  const headers: string[] = [];
  $("table.screener_table thead tr th").each((_, el) => {
    headers.push($(el).text().trim());
  });

  // Parse data rows
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
