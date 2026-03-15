import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getDb } from "@/lib/db";

const SCREENERS: Record<string, { filters: string; extra?: string }> = {
  megacap:  { filters: "cap_mega",           extra: "&o=pe&ft=3" },
  largecap: { filters: "cap_large,geo_usa",  extra: "&o=pe" },
  smallcap: { filters: "cap_small,geo_usa",  extra: "&o=pe" },
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://finviz.com/",
};

const SIGNAL_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function parseFinvizTable(html: string): { headers: string[]; rows: Record<string, string>[] } {
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
  return { headers, rows };
}

function parseNum(s: string | undefined): number {
  if (!s || s === "-") return 0;
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

type SignalLabel = "Strong Buy" | "Buy" | "Neutral" | "Avoid" | "No Data";

function computeSignal(
  pe: string,
  pb: string,
  pfcf: string,
  epsNextY: string
): SignalLabel {
  const peN = parseNum(pe);
  const pbN = parseNum(pb);

  // Require both P/E and P/B — Graham Rule is the core signal
  if (!peN || peN < 0 || !pbN) return "No Data";

  const pfcfN = parseNum(pfcf);
  const epsGrowthN = parseNum(epsNextY);

  let score = 0;

  // Graham Rule: PE × PB < 22.5 — Benjamin Graham's classic value threshold
  if (peN * pbN < 22.5) score += 2;

  // Reasonable absolute P/E
  if (peN < 20) score += 1;

  // Positive free cash flow (P/FCF exists and isn't stretched)
  if (pfcfN > 0 && pfcfN < 35) score += 1;

  // Forward earnings growth estimate
  if (epsGrowthN > 0) score += 1;

  if (score >= 4) return "Strong Buy";
  if (score === 3) return "Buy";
  if (score === 2) return "Neutral";
  return "Avoid";
}

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
  ]
    .filter(Boolean)
    .join(",");

  const baseQuery = `f=${filters}${cfg.extra ?? ""}&r=${r}`;

  // Always fetch overview (display) and financial (dividend) in parallel
  const [res111, res161display] = await Promise.all([
    fetch(`https://finviz.com/screener.ashx?v=111&${baseQuery}`, { headers: HEADERS }),
    fetch(`https://finviz.com/screener.ashx?v=161&${baseQuery}`, { headers: HEADERS }),
  ]);

  if (!res111.ok) {
    return NextResponse.json(
      { error: `Failed to fetch Finviz: ${res111.status}` },
      { status: 502 }
    );
  }

  const { headers: headers111, rows: rows111 } = parseFinvizTable(await res111.text());

  // Attach dividend to every row regardless of signal cache state
  if (res161display.ok) {
    const { rows: rows161 } = parseFinvizTable(await res161display.text());
    const divMap: Record<string, string> = {};
    for (const row of rows161) {
      if (row["Ticker"]) divMap[row["Ticker"]] = row["Dividend"] ?? "";
    }
    for (const row of rows111) {
      if (row["Ticker"]) row["_dividend"] = divMap[row["Ticker"]] ?? "";
    }
  }
  const tickers = rows111.map((r) => r["Ticker"]).filter(Boolean);

  // Load cached signals from SQLite
  const db = getDb();
  const now = Date.now();
  const signalByTicker: Record<string, SignalLabel> = {};
  const needsCompute: string[] = [];

  for (const ticker of tickers) {
    const cached = db
      .prepare("SELECT signal, fetched_at FROM signal_cache WHERE ticker = ?")
      .get(ticker) as { signal: string; fetched_at: string } | undefined;

    if (cached) {
      const age = now - new Date(cached.fetched_at + "Z").getTime();
      if (age < SIGNAL_TTL_MS) {
        signalByTicker[ticker] = cached.signal as SignalLabel;
        continue;
      }
    }
    needsCompute.push(ticker);
  }

  // Only hit Finviz for tickers that need fresh signals
  if (needsCompute.length > 0) {
    const res121 = await fetch(
      `https://finviz.com/screener.ashx?v=121&${baseQuery}`,
      { headers: HEADERS }
    );

    const valByTicker: Record<string, Record<string, string>> = {};
    if (res121.ok) {
      const { rows } = parseFinvizTable(await res121.text());
      for (const row of rows) {
        if (row["Ticker"]) valByTicker[row["Ticker"]] = row;
      }
    }

    const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
    const upsert = db.prepare(
      `INSERT INTO signal_cache (ticker, signal, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(ticker) DO UPDATE SET signal = excluded.signal, fetched_at = excluded.fetched_at`
    );

    for (const ticker of needsCompute) {
      const val = valByTicker[ticker];
      const pe  = rows111.find((r) => r["Ticker"] === ticker)?.["P/E"] ?? "";

      // Only cache if we got real valuation data — otherwise skip caching
      // so the next request tries again
      if (val && val["P/B"]) {
        const signal = computeSignal(pe, val["P/B"], val["P/FCF"] ?? "", val["EPS Next Y"] ?? "");
        upsert.run(ticker, signal, fetched_at);
        signalByTicker[ticker] = signal;
      } else {
        // Missing P/B — can't run Graham Rule, don't cache so next load retries
        signalByTicker[ticker] = "No Data";
      }
    }
  }

  const DROP = new Set(["No.", "Volume", "Industry", "Country", "Change"]);

  // Build final output: drop noise columns, inject "Signal" at front, "Dividend" after Price
  const displayHeaders = [
    "Signal",
    ...headers111
      .filter((h) => !DROP.has(h))
      .flatMap((h) => (h === "Price" ? ["Price", "Dividend"] : [h])),
  ];

  const displayRows = rows111.map((row) => {
    const ticker = row["Ticker"] ?? "";
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!DROP.has(k) && !k.startsWith("_")) cleaned[k] = v;
    }
    return {
      Signal: signalByTicker[ticker] ?? "No Data",
      ...cleaned,
      Dividend: row["_dividend"] ?? "",
    };
  });

  return NextResponse.json({ headers: displayHeaders, rows: displayRows });
}
