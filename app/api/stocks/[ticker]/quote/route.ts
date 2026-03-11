import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

async function scrapePage(url: string, referer?: string) {
  const res = await fetch(url, {
    headers: { ...HEADERS, ...(referer ? { Referer: referer } : {}) },
  });
  if (!res.ok) return null;
  return cheerio.load(await res.text());
}

function extractJsonFromScripts($: ReturnType<typeof cheerio.load>): unknown {
  let found: unknown = null;
  $("script").each((_, el) => {
    if (found) return;
    const content = cheerio.load(el)("script").html() || "";
    const fusionMatch = content.match(/Fusion\.globalContent\s*=\s*(\{[\s\S]+?\});?\s*Fusion/);
    if (fusionMatch) {
      try { found = JSON.parse(fusionMatch[1]); return; } catch {}
    }
    if (content.includes('"description"') && content.includes('"ticker"')) {
      const m = content.match(/(\{[\s\S]{200,}\})/);
      if (m) { try { found = JSON.parse(m[1]); return; } catch {} }
    }
  });
  return found;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFind(obj: any, key: string): string {
  if (!obj || typeof obj !== "object") return "";
  if (typeof obj[key] === "string" && obj[key].length > 20) return obj[key];
  for (const k of Object.keys(obj)) {
    const r = deepFind(obj[k], key);
    if (r) return r;
  }
  return "";
}

function parseTables($: ReturnType<typeof cheerio.load>) {
  const out: {
    incomeStatement: Record<string, string>[];
    balanceSheet: Record<string, string>[];
    cashFlow: Record<string, string>[];
  } = { incomeStatement: [], balanceSheet: [], cashFlow: [] };

  $("table").each((_, table) => {
    const text = $(table).text().toLowerCase();
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    $(table).find("tr").each((i, row) => {
      const cells = $(row).find("th, td");
      if (i === 0) {
        cells.each((_, c) => headers.push($(c).text().trim()));
      } else {
        const entry: Record<string, string> = {};
        cells.each((j, c) => { entry[headers[j] ?? `col_${j}`] = $(c).text().trim(); });
        if (Object.keys(entry).length) rows.push(entry);
      }
    });

    if (text.includes("revenue") || text.includes("net income")) out.incomeStatement = rows;
    else if (text.includes("total assets") || text.includes("liabilit")) out.balanceSheet = rows;
    else if (text.includes("cash flow") || text.includes("operating activities")) out.cashFlow = rows;
  });

  return out;
}

// --- Reuters ---
async function scrapeReuters(symbol: string) {
  const base = `https://www.reuters.com/markets/companies/${symbol}`;
  const [$main, $income, $balance, $cashflow] = await Promise.all([
    scrapePage(`${base}/`, "https://www.reuters.com/"),
    scrapePage(`${base}/financials/income-statement/`, "https://www.reuters.com/"),
    scrapePage(`${base}/financials/balance-sheet/`, "https://www.reuters.com/"),
    scrapePage(`${base}/financials/cash-flow/`, "https://www.reuters.com/"),
  ]);

  let price = "";
  let description = "";

  if ($main) {
    const candidates = ['[data-testid*="price"]', '[class*="Price"]', '[class*="price"]'];
    for (const sel of candidates) {
      const text = $main(sel).first().text().trim();
      if (text && /[\d,]+\.[\d]+/.test(text)) { price = text; break; }
    }

    const metaDesc =
      $main('meta[name="description"]').attr("content") ||
      $main('meta[property="og:description"]').attr("content") || "";
    if (metaDesc.length > 100) description = metaDesc;

    if (!description) {
      const json = extractJsonFromScripts($main);
      if (json) {
        description = deepFind(json, "description") || deepFind(json, "longDescription") ||
          deepFind(json, "businessSummary") || deepFind(json, "profileText") || "";
      }
    }

    if (!description) {
      const selectors = [
        '[data-testid*="description"]', '[data-testid*="profile"]',
        '[class*="description"]', '[class*="profile"]',
        '[class*="about"]', '[class*="overview"]', "section p", "article p",
      ];
      for (const sel of selectors) {
        $main(sel).each((_, el) => {
          const t = $main(el).text().trim();
          if (t.length > 80 && !description) description = t;
        });
        if (description) break;
      }
    }
  }

  const financials = { incomeStatement: [] as Record<string, string>[], balanceSheet: [] as Record<string, string>[], cashFlow: [] as Record<string, string>[] };
  if ($income) financials.incomeStatement = parseTables($income).incomeStatement;
  if ($balance) financials.balanceSheet = parseTables($balance).balanceSheet;
  if ($cashflow) financials.cashFlow = parseTables($cashflow).cashFlow;
  if ($main && !financials.incomeStatement.length && !financials.balanceSheet.length) {
    const f = parseTables($main);
    financials.incomeStatement = f.incomeStatement;
    financials.balanceSheet = f.balanceSheet;
    financials.cashFlow = f.cashFlow;
  }

  return { price, description, financials };
}

// --- Finviz fallback ---
async function scrapeFinviz(symbol: string) {
  const $ = await scrapePage(
    `https://finviz.com/quote.ashx?t=${symbol}`,
    "https://finviz.com/"
  );
  if (!$) return null;

  // Price
  const price =
    $("strong.quote-price, .snapshot-td2 b").first().text().trim() ||
    $("table.fullview-title").find("b").last().text().trim() ||
    "";

  // Description
  const description =
    $("td.fullview-profile").text().trim() ||
    $('[class*="body-text"]').text().trim() ||
    "";

  // Extract all snapshot key/value pairs
  const stats: Record<string, string> = {};
  $("table.snapshot-table2 tr, table.fullview-ratings-outer tr").each((_, row) => {
    const cells = $(row).find("td");
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const key = $(cells[i]).text().trim();
      const val = $(cells[i + 1]).text().trim();
      if (key && val) stats[key] = val;
    }
  });

  const pick = (keys: string[]) => {
    const row: Record<string, string> = {};
    keys.forEach((k) => { if (stats[k]) row[k] = stats[k]; });
    return Object.keys(row).length ? [row] : [];
  };

  const financials = {
    incomeStatement: pick(["Revenue", "Revenue/sh", "Sales Q/Q", "EPS (ttm)",
      "EPS next Y", "EPS this Y", "EPS Q/Q", "Gross Margin",
      "Oper. Margin", "Profit Margin", "ROE", "ROA", "ROI"]),
    balanceSheet: pick(["Market Cap", "Book/sh", "Cash/sh", "Debt/Eq",
      "LT Debt/Eq", "Current Ratio", "Quick Ratio",
      "Shs Outstand", "Shs Float"]),
    cashFlow: pick(["P/FCF", "FCF/sh", "P/C", "Cash/sh"]),
  };

  return { price, description, financials };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const reuters = await scrapeReuters(symbol);

  const hasData =
    reuters.price || reuters.description ||
    reuters.financials.incomeStatement.length ||
    reuters.financials.balanceSheet.length ||
    reuters.financials.cashFlow.length;

  if (hasData) {
    return NextResponse.json({ ticker: symbol, ...reuters, source: "reuters" });
  }

  // Fallback to Finviz
  const finviz = await scrapeFinviz(symbol);
  if (finviz) {
    return NextResponse.json({ ticker: symbol, ...finviz, priceChange: "", source: "finviz" });
  }

  return NextResponse.json({ ticker: symbol, price: "", priceChange: "", description: "", financials: { incomeStatement: [], balanceSheet: [], cashFlow: [] }, source: "none" });
}
