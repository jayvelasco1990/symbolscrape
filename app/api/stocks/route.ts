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

function parseNumN(s: string | undefined): number | null {
  if (!s || s === "-") return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

const SECTOR_TO_ETF: Record<string, string> = {
  "Technology":             "XLK",
  "Financial":              "XLF",
  "Financial Services":     "XLF",
  "Healthcare":             "XLV",
  "Health Care":            "XLV",
  "Energy":                 "XLE",
  "Utilities":              "XLU",
  "Industrials":            "XLI",
  "Consumer Defensive":     "XLP",
  "Consumer Cyclical":      "XLY",
  "Basic Materials":        "XLB",
  "Real Estate":            "XLRE",
  "Communication Services": "XLC",
};

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
  const beta     = request.nextUrl.searchParams.get("beta") ?? "";

  const VALID_BETA = new Set(["u0.5","u1","u1.5","u2","o0.5","o1","o1.5","o2"]);

  const cfg = SCREENERS[screener] ?? SCREENERS.megacap;
  const filters = [
    cfg.filters,
    dividend ? "fa_div_pos" : "",
    VALID_BETA.has(beta) ? `ta_beta_${beta}` : "",
    rsi ? "ta_rsi_nob50" : "",
  ]
    .filter(Boolean)
    .join(",");

  const baseQuery = `f=${filters}${cfg.extra ?? ""}&r=${r}`;
  const db = getDb();

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
  // Load RS perf from cache; only fetch Yahoo Finance for stale/missing tickers
  const RS_TTL_MS = 6 * 60 * 60 * 1000;
  const tickersForPerf = rows111.map((r) => r["Ticker"]).filter(Boolean);
  const perfByTicker: Record<string, { ytd: number | null; month: number | null }> = {};
  const needsRsFetch: string[] = [];

  for (const ticker of tickersForPerf) {
    const cached = db
      .prepare("SELECT ytd, month, fetched_at FROM rs_cache WHERE ticker = ?")
      .get(ticker) as { ytd: number | null; month: number | null; fetched_at: string } | undefined;
    if (cached && Date.now() - new Date(cached.fetched_at + "Z").getTime() < RS_TTL_MS) {
      perfByTicker[ticker] = { ytd: cached.ytd, month: cached.month };
    } else {
      needsRsFetch.push(ticker);
    }
  }

  if (needsRsFetch.length > 0) {
    const fetched = await Promise.all(
      needsRsFetch.map(async (ticker) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=ytd&includePrePost=false`,
            { headers: { "User-Agent": HEADERS["User-Agent"] } }
          );
          if (!res.ok) return null;
          const json = await res.json();
          const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
          const valid = closes.filter((c): c is number => c != null);
          if (valid.length < 2) return null;
          const last = valid[valid.length - 1];
          return {
            ytd:   parseFloat(((last / valid[0] - 1) * 100).toFixed(2)),
            month: parseFloat(((last / valid[Math.max(0, valid.length - 22)] - 1) * 100).toFixed(2)),
          };
        } catch { return null; }
      })
    );

    const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
    const upsertRS = db.prepare(
      `INSERT INTO rs_cache (ticker, ytd, month, fetched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(ticker) DO UPDATE SET ytd = excluded.ytd, month = excluded.month, fetched_at = excluded.fetched_at`
    );
    needsRsFetch.forEach((ticker, i) => {
      const result = fetched[i];
      perfByTicker[ticker] = result ?? { ytd: null, month: null };
      upsertRS.run(ticker, result?.ytd ?? null, result?.month ?? null, fetched_at);
    });
  }

  // Load sector ETF YTD + 1M from macro cache for RS baseline
  const sectorYTD: Record<string, number> = {};
  const sectorMo:  Record<string, number> = {};
  try {
    const macroCached = db.prepare("SELECT data FROM macro_cache WHERE id = 1").get() as { data: string } | undefined;
    if (macroCached) {
      const macroData = JSON.parse(macroCached.data);
      for (const s of macroData.sectors ?? []) {
        if (s.symbol && s.perfYTD   != null) sectorYTD[s.symbol] = s.perfYTD;
        if (s.symbol && s.perfMonth != null) sectorMo[s.symbol]  = s.perfMonth;
      }
    }
  } catch { /* macro cache unavailable — RS will show as blank */ }

  function computeRS(ticker: string, sector: string): string {
    const perf = perfByTicker[ticker];
    if (!perf || perf.ytd == null) return "";
    const etf = SECTOR_TO_ETF[sector];
    if (!etf || sectorYTD[etf] == null) return "";
    const rsYTD = perf.ytd - sectorYTD[etf];
    let trend = "";
    if (perf.month != null && sectorMo[etf] != null) {
      const rsMo = perf.month - sectorMo[etf];
      trend = rsMo > rsYTD + 1 ? "↑" : rsMo < rsYTD - 1 ? "↓" : "→";
    }
    return `${rsYTD.toFixed(1)}|${trend}`;
  }

  const tickers = rows111.map((r) => r["Ticker"]).filter(Boolean);

  // Load cached signals from SQLite
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

  // Build final output: drop noise columns, inject "Signal" + "RS" at front, "Dividend" after Price
  const displayHeaders = [
    "Signal",
    "RS",
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
      RS: computeRS(ticker, row["Sector"] ?? ""),
      ...cleaned,
      Dividend: row["_dividend"] ?? "",
    };
  });

  return NextResponse.json({ headers: displayHeaders, rows: displayRows });
}
