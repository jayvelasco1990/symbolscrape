import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { computeRiskProfile, computeRateSensitivity } from "@/lib/riskScores";

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
        cells.each((_, c) => { headers.push($(c).text().trim()); });
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

  const financials = {
    incomeStatement: [] as Record<string, string>[],
    balanceSheet: [] as Record<string, string>[],
    cashFlow: [] as Record<string, string>[],
  };
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

async function scrapeFinviz(symbol: string) {
  const $ = await scrapePage(
    `https://finviz.com/quote.ashx?t=${symbol}`,
    "https://finviz.com/"
  );
  if (!$) return null;

  const stats: Record<string, string> = {};

  $("table.snapshot-table2 tr, table.fullview-ratings-outer tr").each((_, row) => {
    const cells = $(row).find("td");
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const key = $(cells[i]).text().trim();
      const val = $(cells[i + 1]).text().trim();
      if (key && val) stats[key] = val;
    }
  });

  const price = stats["Price"] ?? "";

  const description =
    $("td.fullview-profile").text().trim() ||
    $('[class*="body-text"]').text().trim() ||
    "";

  const pick = (keys: string[]) => {
    const row: Record<string, string> = {};
    keys.forEach((k) => { if (stats[k]) row[k] = stats[k]; });
    return Object.keys(row).length ? [row] : [];
  };

  const financials = {
    incomeStatement: pick(["Sales", "Income", "Sales Q/Q", "EPS (ttm)",
      "EPS next Y", "EPS this Y", "EPS Q/Q", "Gross Margin",
      "Oper. Margin", "Profit Margin", "ROE", "ROA", "ROI"]),
    balanceSheet: pick(["Market Cap", "Enterprise Value", "Book/sh", "Cash/sh", "Debt/Eq",
      "LT Debt/Eq", "Current Ratio", "Quick Ratio", "Shs Outstand", "Shs Float"]),
    cashFlow: pick(["EV/EBITDA", "P/FCF", "FCF/sh", "P/C", "Cash/sh"]),
  };

  // Sector is shown as a link with href containing "sec_" on the Finviz quote page
  const sector = $('a[href*="sec_"]').first().text().trim();
  const industry = $('a[href*="ind_"]').first().text().trim();

  return { price, description, financials, stats, sector, industry };
}

function parseFormatted(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!n) return 0;
  if (s.includes("T")) return n * 1e12;
  if (s.includes("B")) return n * 1e9;
  if (s.includes("M")) return n * 1e6;
  return n;
}

function calcDebtMetrics(stats: Record<string, string>): { debtToRevenue: string; debtToEbitda: string } {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;

  // Derive total debt from Debt/Equity × (Book/sh × Shares Outstanding)
  const debtEq = parseVal(stats["Debt/Eq"] ?? "");
  const bookSh = parseVal(stats["Book/sh"] ?? "");
  const shsOutstand = parseFormatted(stats["Shs Outstand"] ?? "");
  const totalDebt = debtEq * bookSh * shsOutstand;

  // Debt / Revenue  (Finviz key is "Sales")
  const sales = parseFormatted(stats["Sales"] ?? "");
  const debtToRevenue = totalDebt && sales ? (totalDebt / sales).toFixed(2) : "";

  // Debt / EBITDA  (EBITDA = Enterprise Value / EV/EBITDA)
  const ev = parseFormatted(stats["Enterprise Value"] ?? "");
  const evEbitda = parseVal(stats["EV/EBITDA"] ?? "");
  const ebitda = ev && evEbitda ? ev / evEbitda : 0;
  const debtToEbitda = totalDebt && ebitda ? (totalDebt / ebitda).toFixed(2) : "";

  return { debtToRevenue, debtToEbitda };
}

function calcDividendMetrics(stats: Record<string, string>) {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;

  // "Dividend TTM: 2.06 (2.66%)" — parse amount and yield
  const divTTM = stats["Dividend TTM"] ?? "";
  const amountMatch = divTTM.match(/^([\d.]+)/);
  const yieldMatch  = divTTM.match(/\(([\d.]+)%\)/);
  const annualAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  const yieldPct     = yieldMatch  ? parseFloat(yieldMatch[1])  : 0;

  if (!annualAmount && !yieldPct) return null;

  // Payout ratio — already a percentage string e.g. "67.13%"
  const payoutPct = parseVal(stats["Payout"] ?? "");

  // FCF coverage: FCF/sh = Price / P/FCF
  const price  = parseVal(stats["Price"] ?? "");
  const pfcf   = parseVal(stats["P/FCF"] ?? "");
  const fcfSh  = price && pfcf ? price / pfcf : 0;
  const fcfCoverage = annualAmount && fcfSh ? fcfSh / annualAmount : 0;

  // Dividend growth "5.04% 4.46%" → [3Y, 5Y]
  const divGrStr = stats["Dividend Gr. 3/5Y"] ?? "";
  const grMatches = divGrStr.match(/([-\d.]+)%/g) ?? [];
  const growth3Y = grMatches[0] ?? "";
  const growth5Y = grMatches[1] ?? "";

  // Sustainability: combine payout and FCF coverage
  let sustainability: "healthy" | "moderate" | "risk" | "unknown" = "unknown";
  if (payoutPct > 0 || fcfCoverage > 0) {
    const payoutOk  = payoutPct > 0 && payoutPct <= 60;
    const fcfOk     = fcfCoverage >= 1.2;
    const payoutWarn = payoutPct > 60 && payoutPct <= 80;
    const fcfWarn    = fcfCoverage >= 0.8 && fcfCoverage < 1.2;
    if ((payoutPct <= 60 || !payoutPct) && (fcfCoverage >= 1.2 || !fcfCoverage)) sustainability = "healthy";
    else if (payoutOk || fcfOk) sustainability = "healthy";
    else if (payoutWarn || fcfWarn) sustainability = "moderate";
    else sustainability = "risk";
  }

  return {
    annualAmount: annualAmount ? annualAmount.toFixed(2) : "",
    yieldPct: yieldPct ? yieldPct.toFixed(2) : "",
    payoutPct: payoutPct ? payoutPct.toFixed(1) : "",
    fcfCoverage: fcfCoverage ? fcfCoverage.toFixed(2) : "",
    growth3Y,
    growth5Y,
    sustainability,
  };
}

function calcMoatQuality(stats: Record<string, string>) {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;

  const roe          = parseVal(stats["ROE"] ?? "");
  const roic         = parseVal(stats["ROIC"] ?? "");
  const profitMargin = parseVal(stats["Profit Margin"] ?? "");

  let score = 0;
  if (roe > 20)         score += 2; else if (roe >= 12)         score += 1;
  if (roic > 15)        score += 2; else if (roic >= 8)         score += 1;
  if (profitMargin > 15) score += 2; else if (profitMargin >= 8) score += 1;

  const level =
    score >= 5 ? "Strong" :
    score >= 3 ? "Moderate" :
    score >= 1 ? "Narrow"   : "Weak";

  return {
    score,
    level,
    roe:          stats["ROE"]           ?? "",
    roic:         stats["ROIC"]          ?? "",
    profitMargin: stats["Profit Margin"] ?? "",
    operMargin:   stats["Oper. Margin"]  ?? "",
  };
}

function calcInsiderActivity(stats: Record<string, string>) {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;

  const ownPct   = parseVal(stats["Insider Own"]   ?? "");
  const transRaw = stats["Insider Trans"] ?? "";
  const transN   = parseVal(transRaw);
  const trans    = transRaw.trim().startsWith("-") ? -Math.abs(transN) : transN;

  const trend: "Buying" | "Neutral" | "Selling" =
    trans > 1 ? "Buying" : trans < -1 ? "Selling" : "Neutral";

  const ownershipLevel: "High" | "Moderate" | "Low" =
    ownPct >= 10 ? "High" : ownPct >= 3 ? "Moderate" : "Low";

  return {
    ownershipPct:   stats["Insider Own"]   ?? "",
    transPct:       stats["Insider Trans"] ?? "",
    trans,
    trend,
    ownershipLevel,
  };
}

function calcIntrinsicValue(stats: Record<string, string>) {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
  const eps = parseVal(stats["EPS (ttm)"] ?? "");
  const bookSh = parseVal(stats["Book/sh"] ?? "");

  if (eps <= 0 || bookSh <= 0) {
    return {
      fairValue: "",
      formula: "Graham Number = √(22.5 × EPS × Book/sh)",
      note: eps <= 0 ? "Negative or zero EPS — Graham Number not applicable" : "",
    };
  }

  return {
    fairValue: Math.sqrt(22.5 * eps * bookSh).toFixed(2),
    formula: "Graham Number = √(22.5 × EPS × Book/sh)",
    note: "",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const [reuters, finviz] = await Promise.all([
    scrapeReuters(symbol),
    scrapeFinviz(symbol),
  ]);

  const intrinsicValue  = calcIntrinsicValue(finviz?.stats ?? {});
  const { debtToRevenue, debtToEbitda } = calcDebtMetrics(finviz?.stats ?? {});
  const dividendMetrics = calcDividendMetrics(finviz?.stats ?? {});
  const moatQuality     = calcMoatQuality(finviz?.stats ?? {});
  const insiderActivity = calcInsiderActivity(finviz?.stats ?? {});
  const riskProfile     = computeRiskProfile(finviz?.sector ?? "", finviz?.description || reuters.description);
  const rateSensitivity = computeRateSensitivity(finviz?.sector ?? "");

  const hasReutersData =
    reuters.financials.incomeStatement.length ||
    reuters.financials.balanceSheet.length ||
    reuters.financials.cashFlow.length;

  const quality = { moatQuality, insiderActivity, riskProfile, rateSensitivity };

  if (hasReutersData) {
    return NextResponse.json({
      ticker: symbol,
      ...reuters,
      price: finviz?.price || reuters.price,
      description: finviz?.description || reuters.description,
      intrinsicValue,
      debtToRevenue, debtToEbitda, dividendMetrics,
      ...quality,
    });
  }

  if (finviz) {
    const { stats: _, ...finvizWithoutStats } = finviz;
    return NextResponse.json({
      ticker: symbol,
      ...finvizWithoutStats,
      priceChange: "",
      intrinsicValue,
      debtToRevenue, debtToEbitda, dividendMetrics,
      ...quality,
    });
  }

  return NextResponse.json({
    ticker: symbol,
    price: "",
    priceChange: "",
    description: "",
    financials: { incomeStatement: [], balanceSheet: [], cashFlow: [] },
    intrinsicValue,
    dividendMetrics: null,
    debtToRevenue: "",
    debtToEbitda: "",
    ...quality,
  });
}
