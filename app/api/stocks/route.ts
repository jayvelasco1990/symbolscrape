import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const SCREENERS: Record<string, { filters: string; extra?: string }> = {
  megacap:  { filters: "cap_mega",  extra: "&o=pe&ft=3" },
  largecap: { filters: "cap_large,geo_usa", extra: "&o=pe" },
  smallcap: { filters: "cap_small,geo_usa", extra: "&o=pe" },
};

export async function GET(request: NextRequest) {
  const screener = request.nextUrl.searchParams.get("screener") ?? "megacap";
  const r        = request.nextUrl.searchParams.get("r") ?? "1";
  const dividend = request.nextUrl.searchParams.get("dividend") === "true";
  const rsi      = request.nextUrl.searchParams.get("rsi") === "true";

  const cfg = SCREENERS[screener] ?? SCREENERS.megacap;
  const filters = [
    cfg.filters,
    dividend ? "fa_div_pos" : "",
    "ta_beta_u1",
    rsi ? "ta_rsi_nob50" : "",
  ].filter(Boolean).join(",");

  const url = `https://finviz.com/screener.ashx?v=111&f=${filters}${cfg.extra ?? ""}&r=${r}`;

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
