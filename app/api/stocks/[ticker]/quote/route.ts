import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://www.reuters.com/",
};

function extractJsonFromScripts($: ReturnType<typeof cheerio.load>): unknown {
  let found: unknown = null;
  $("script").each((_, el) => {
    if (found) return;
    const content = cheerio.load(el)("script").html() || "";
    // Arc XP / Fusion pattern
    const fusionMatch = content.match(/Fusion\.globalContent\s*=\s*(\{[\s\S]+?\});?\s*Fusion/);
    if (fusionMatch) {
      try { found = JSON.parse(fusionMatch[1]); return; } catch {}
    }
    // Standalone JSON blob in script tag with company data
    if (content.includes('"description"') && content.includes('"ticker"')) {
      const jsonMatch = content.match(/(\{[\s\S]{200,}\})/);
      if (jsonMatch) {
        try { found = JSON.parse(jsonMatch[1]); return; } catch {}
      }
    }
  });
  return found;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFind(obj: any, key: string): string {
  if (!obj || typeof obj !== "object") return "";
  if (typeof obj[key] === "string" && obj[key].length > 20) return obj[key];
  for (const k of Object.keys(obj)) {
    const result = deepFind(obj[k], key);
    if (result) return result;
  }
  return "";
}

async function scrapePage(url: string) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const html = await res.text();
  return cheerio.load(html);
}

function parseTables($: ReturnType<typeof cheerio.load>) {
  const financials: {
    incomeStatement: Record<string, string>[];
    balanceSheet: Record<string, string>[];
    cashFlow: Record<string, string>[];
  } = { incomeStatement: [], balanceSheet: [], cashFlow: [] };

  $("table").each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    const headers: string[] = [];
    const rows: Record<string, string>[] = [];

    $(table).find("tr").each((i, row) => {
      const cells = $(row).find("th, td");
      if (i === 0) {
        cells.each((_, cell) => headers.push($(cell).text().trim()));
      } else {
        const entry: Record<string, string> = {};
        cells.each((j, cell) => {
          entry[headers[j] ?? `col_${j}`] = $(cell).text().trim();
        });
        if (Object.keys(entry).length > 0) rows.push(entry);
      }
    });

    if (tableText.includes("revenue") || tableText.includes("net income")) {
      financials.incomeStatement = rows;
    } else if (tableText.includes("total assets") || tableText.includes("liabilit")) {
      financials.balanceSheet = rows;
    } else if (tableText.includes("cash flow") || tableText.includes("operating activities")) {
      financials.cashFlow = rows;
    }
  });

  return financials;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const base = `https://www.reuters.com/markets/companies/${symbol}`;

  // Fetch main page + financials pages in parallel
  const [$main, $income, $balance, $cashflow] = await Promise.all([
    scrapePage(`${base}/`),
    scrapePage(`${base}/financials/income-statement/`),
    scrapePage(`${base}/financials/balance-sheet/`),
    scrapePage(`${base}/financials/cash-flow/`),
  ]);

  // --- Price ---
  let price = "";
  let priceChange = "";
  if ($main) {
    // Try meta tags
    price =
      $main('meta[property="og:title"]').attr("content")?.match(/[\d,.]+/)?.[0] ?? "";

    // Try visible elements
    if (!price) {
      const candidates = [
        '[data-testid*="price"]',
        '[class*="Price"]',
        '[class*="price"]',
        '[class*="quote"]',
      ];
      for (const sel of candidates) {
        const text = $main(sel).first().text().trim();
        if (text && /[\d,]+\.[\d]+/.test(text)) { price = text; break; }
      }
    }
  }

  // --- Description ---
  let description = "";
  if ($main) {
    // Try meta description first
    const metaDesc =
      $main('meta[name="description"]').attr("content") ||
      $main('meta[property="og:description"]').attr("content") ||
      "";

    // Only use meta if it's substantive (not generic)
    if (metaDesc.length > 100) description = metaDesc;

    // Try embedded JSON from Arc/Fusion
    if (!description) {
      const json = extractJsonFromScripts($main);
      if (json) {
        description =
          deepFind(json, "description") ||
          deepFind(json, "longDescription") ||
          deepFind(json, "businessSummary") ||
          deepFind(json, "profileText") ||
          "";
      }
    }

    // Try visible paragraphs in profile/about sections
    if (!description) {
      const selectors = [
        '[data-testid*="description"]',
        '[data-testid*="profile"]',
        '[class*="description"]',
        '[class*="profile"]',
        '[class*="about"]',
        '[class*="overview"]',
        "section p",
        "article p",
      ];
      for (const sel of selectors) {
        $main(sel).each((_, el) => {
          const text = $main(el).text().trim();
          if (text.length > 80 && !description) description = text;
        });
        if (description) break;
      }
    }
  }

  // --- Financials ---
  const financials: {
    incomeStatement: Record<string, string>[];
    balanceSheet: Record<string, string>[];
    cashFlow: Record<string, string>[];
  } = { incomeStatement: [], balanceSheet: [], cashFlow: [] };

  if ($income) {
    const f = parseTables($income);
    financials.incomeStatement = f.incomeStatement;
  }
  if ($balance) {
    const f = parseTables($balance);
    financials.balanceSheet = f.balanceSheet;
  }
  if ($cashflow) {
    const f = parseTables($cashflow);
    financials.cashFlow = f.cashFlow;
  }
  // Fallback: parse all from main page
  if ($main && !financials.incomeStatement.length && !financials.balanceSheet.length) {
    const f = parseTables($main);
    financials.incomeStatement = f.incomeStatement;
    financials.balanceSheet = f.balanceSheet;
    financials.cashFlow = f.cashFlow;
  }

  return NextResponse.json({
    ticker: symbol,
    price,
    priceChange,
    description,
    financials,
  });
}
