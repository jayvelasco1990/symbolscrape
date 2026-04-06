import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { computeRiskProfile, computeRateSensitivity } from "@/lib/riskScores";
import { getDb } from "@/lib/db";

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

async function fetchExtendedMarket(symbol: string) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`,
      { headers: { "User-Agent": HEADERS["User-Agent"] } }
    );
    if (!res.ok) {
      console.error(`[extendedMarket] ${symbol} HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const p = json?.quoteSummary?.result?.[0]?.price;
    if (!p) {
      console.error(`[extendedMarket] ${symbol} no price module:`, JSON.stringify(json).slice(0, 300));
      return null;
    }

    const raw  = (field: { raw?: number } | undefined) => field?.raw ?? null;
    const fmt2 = (n: number) => n.toFixed(2);
    const fmtPct    = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
    const fmtChange = (n: number) => `${n >= 0 ? "+" : ""}${fmt2(n)}`;
    const fmtTime   = (ts: number) =>
      new Date(ts * 1000).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/New_York",
      });

    const regPrice  = raw(p.regularMarketPrice);
    const regChange = raw(p.regularMarketChange);
    const regPct    = raw(p.regularMarketChangePercent);
    const prePx     = raw(p.preMarketPrice);
    const preChg    = raw(p.preMarketChange);
    const prePct    = raw(p.preMarketChangePercent);
    const postPx    = raw(p.postMarketPrice);
    const postChg   = raw(p.postMarketChange);
    const postPct   = raw(p.postMarketChangePercent);

    return {
      marketState:       (p.marketState ?? "CLOSED") as string,
      regularPrice:      regPrice  != null ? fmt2(regPrice)        : null,
      regularChange:     regChange != null ? fmtChange(regChange)  : null,
      regularChangePct:  regPct    != null ? fmtPct(regPct * 100)  : null,
      preMarketPrice:    prePx     != null ? fmt2(prePx)           : null,
      preMarketChange:   preChg    != null ? fmtChange(preChg)     : null,
      preMarketChangePct: prePct   != null ? fmtPct(prePct * 100)  : null,
      preMarketTime:     p.preMarketTime  != null ? fmtTime(p.preMarketTime)  : null,
      postMarketPrice:   postPx    != null ? fmt2(postPx)          : null,
      postMarketChange:  postChg   != null ? fmtChange(postChg)    : null,
      postMarketChangePct: postPct != null ? fmtPct(postPct * 100) : null,
      postMarketTime:    p.postMarketTime != null ? fmtTime(p.postMarketTime) : null,
    };
  } catch (e) {
    console.error(`[extendedMarket] ${symbol} error:`, e);
    return null;
  }
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

// Net Cash per Share = Cash/sh - (Debt/Eq × Book/sh)
// If price < Net Cash/sh, stock trades below its cash value — classic Graham net-net territory
function calcNetCash(stats: Record<string, string>): string {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
  const cashSh  = parseVal(stats["Cash/sh"]  ?? "");
  const bookSh  = parseVal(stats["Book/sh"]  ?? "");
  const debtEq  = parseVal(stats["Debt/Eq"]  ?? "");
  if (!cashSh && !bookSh) return "";
  // Debt/Eq = Total Debt / Book Equity → Total Debt per share = Debt/Eq × Book/sh
  const netCash = cashSh - debtEq * bookSh;
  return netCash.toFixed(2);
}

function calcDebtMetrics(stats: Record<string, string>): { debtToRevenue: string; debtToEbitda: string } {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
  const debtEq = parseVal(stats["Debt/Eq"] ?? "");
  const bookSh = parseVal(stats["Book/sh"] ?? "");
  const shsOutstand = parseFormatted(stats["Shs Outstand"] ?? "");
  const totalDebt = debtEq * bookSh * shsOutstand;
  const sales = parseFormatted(stats["Sales"] ?? "");
  const debtToRevenue = totalDebt && sales ? (totalDebt / sales).toFixed(2) : "";
  const ev = parseFormatted(stats["Enterprise Value"] ?? "");
  const evEbitda = parseVal(stats["EV/EBITDA"] ?? "");
  const ebitda = ev && evEbitda ? ev / evEbitda : 0;
  const debtToEbitda = totalDebt && ebitda ? (totalDebt / ebitda).toFixed(2) : "";
  return { debtToRevenue, debtToEbitda };
}

interface GrowthMetrics {
  revenueGrowthPct: string;
  grossMarginPct: string;
  fcfMarginPct: string;
  rule40: string;
  evToRevenue: string;
}

function calcGrowthMetrics(stats: Record<string, string>): GrowthMetrics | null {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;

  const grossMargin     = parseVal(stats["Gross Margin"] ?? "");
  const salesQQ         = parseVal(stats["Sales Q/Q"]    ?? ""); // quarterly YoY revenue growth
  const price           = parseVal(stats["Price"]        ?? "");
  const pfcf            = parseVal(stats["P/FCF"]        ?? "");
  const sales           = parseFormatted(stats["Sales"]  ?? "");
  const shsOutstand     = parseFormatted(stats["Shs Outstand"] ?? "");
  const ev              = parseFormatted(stats["Enterprise Value"] ?? "");

  if (!grossMargin && !salesQQ) return null;

  // FCF/sh = Price / P/FCF; FCF = FCF/sh × shares; FCF margin = FCF / Sales
  const fcfSh     = price && pfcf ? price / pfcf : 0;
  const fcfTotal  = fcfSh && shsOutstand ? fcfSh * shsOutstand : 0;
  const fcfMargin = fcfTotal && sales ? (fcfTotal / sales) * 100 : 0;

  const evToRev = ev && sales ? ev / sales : 0;
  const rule40  = salesQQ && fcfMargin ? salesQQ + fcfMargin : 0;

  return {
    revenueGrowthPct: salesQQ    ? salesQQ.toFixed(1)    : "",
    grossMarginPct:   grossMargin ? grossMargin.toFixed(1) : "",
    fcfMarginPct:     fcfMargin  ? fcfMargin.toFixed(1)  : "",
    rule40:           rule40     ? rule40.toFixed(1)     : "",
    evToRevenue:      evToRev    ? evToRev.toFixed(1)    : "",
  };
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
  const roe          = parseVal(stats["ROE"]           ?? "");
  const roic         = parseVal(stats["ROIC"]          ?? "");
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
    score, level,
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
  const eps    = parseVal(stats["EPS (ttm)"] ?? "");
  const bookSh = parseVal(stats["Book/sh"]   ?? "");

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

function calcFCFConversion(stats: Record<string, string>) {
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
  const price = parseVal(stats["Price"]      ?? "");
  const pfcf  = parseVal(stats["P/FCF"]      ?? "");
  const eps   = parseVal(stats["EPS (ttm)"]  ?? "");
  if (!price || !pfcf || !eps || eps <= 0) return null;
  const fcfPerShare = price / pfcf;
  const pct = (fcfPerShare / eps) * 100;
  const label =
    pct >= 100 ? "Excellent" :
    pct >= 80  ? "Good"      :
    pct >= 60  ? "Moderate"  : "Weak";
  return { pct: pct.toFixed(0), label };
}

const SEC_UA  = "vpfund-app/1.0 research@vpfund.example.com";
const SEC_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchSecMungerData(symbol: string) {
  const db = getDb();

  // Serve from cache if fresh
  const cached = db
    .prepare("SELECT * FROM sec_cache WHERE ticker = ?")
    .get(symbol) as Record<string, string | number> | undefined;
  if (cached && Date.now() - new Date((cached.fetched_at as string) + "Z").getTime() < SEC_TTL) {
    return {
      capitalIntensity:      cached.capital_intensity      != null ? (cached.capital_intensity as number).toFixed(1) : null,
      capitalIntensityLabel: (cached.capital_intensity_label as string) ?? null,
      earningsConsistency:   (cached.earnings_consistency  as string) ?? null,
      consistencyYears:      (cached.consistency_years     as number) ?? 0,
      avgRoe:                cached.avg_roe   != null ? (cached.avg_roe   as number).toFixed(1) : null,
      avgMargin:             cached.avg_margin != null ? (cached.avg_margin as number).toFixed(1) : null,
    };
  }

  try {
    // Step 1: CIK lookup via SEC EDGAR
    const cikRes = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=10-K&dateb=&owner=include&count=1&output=atom`,
      { headers: { "User-Agent": SEC_UA } }
    );
    if (!cikRes.ok) return null;
    const cikXml  = await cikRes.text();
    const cikMatch = cikXml.match(/CIK=(\d+)/);
    if (!cikMatch) return null;
    const cik = cikMatch[1].padStart(10, "0");

    // Step 2: Company facts (XBRL)
    const factsRes = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      { headers: { "User-Agent": SEC_UA } }
    );
    if (!factsRes.ok) return null;
    const facts = await factsRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gaap = (facts as any)?.facts?.["us-gaap"] ?? {};

    // Extract deduplicated annual values for a concept
    function getAnnual(concept: string): { end: string; val: number }[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: any[] = gaap[concept]?.units?.USD ?? [];
      const map = new Map<string, { end: string; val: number; filed: string }>();
      for (const e of entries) {
        if (e.fp === "FY" && e.form === "10-K" && e.val != null) {
          const ex = map.get(e.end);
          if (!ex || e.filed > ex.filed) map.set(e.end, { end: e.end, val: e.val, filed: e.filed });
        }
      }
      return [...map.values()].sort((a, b) => b.end.localeCompare(a.end)).slice(0, 5);
    }

    const capexData = getAnnual("PaymentsToAcquirePropertyPlantAndEquipment");
    let revData: { end: string; val: number }[] = [];
    for (const tag of [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues", "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
    ]) {
      revData = getAnnual(tag);
      if (revData.length) break;
    }
    const niData  = getAnnual("NetIncomeLoss");
    const eqData  = getAnnual("StockholdersEquity");

    // Capital Intensity: |CapEx| / Revenue (most recent annual)
    let capitalIntensity: number | null = null;
    let capitalIntensityLabel: string | null = null;
    if (capexData.length && revData.length) {
      const pct = (Math.abs(capexData[0].val) / revData[0].val) * 100;
      if (pct > 0 && pct < 80) {
        capitalIntensity      = parseFloat(pct.toFixed(1));
        capitalIntensityLabel = pct < 3 ? "Asset-light" : pct < 10 ? "Moderate" : "Capital-heavy";
      }
    }

    // Earnings Consistency: CV of net margin + ROE over up to 4 years
    const revMap = new Map(revData.map((d) => [d.end, d.val]));
    const eqMap  = new Map(eqData.map((d) => [d.end, d.val]));
    const margins: number[] = [];
    const roes:    number[] = [];

    for (const ni of niData.slice(0, 4)) {
      const rev = revMap.get(ni.end);
      const eq  = eqMap.get(ni.end);
      if (rev && rev > 0) margins.push((ni.val / rev) * 100);
      if (eq  && eq  > 0) roes.push((ni.val / eq) * 100);
    }

    const cv = (arr: number[]) => {
      if (arr.length < 2) return null;
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (Math.abs(mean) < 0.5) return null;
      const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
      return std / Math.abs(mean);
    };

    let earningsConsistency: string | null = null;
    let consistencyYears = 0;
    let avgRoe: number | null = null;
    let avgMargin: number | null = null;

    const combined = (() => {
      const mc = cv(margins); const rc = cv(roes);
      return mc != null && rc != null ? (mc + rc) / 2 : mc ?? rc;
    })();

    if (combined != null && margins.length >= 2) {
      earningsConsistency = combined < 0.15 ? "High" : combined < 0.35 ? "Moderate" : "Low";
      consistencyYears    = margins.length;
      avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
      if (roes.length >= 2) avgRoe = roes.reduce((a, b) => a + b, 0) / roes.length;
    }

    // Persist to cache
    const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
    db.prepare(`
      INSERT INTO sec_cache
        (ticker, cik, capital_intensity, capital_intensity_label, earnings_consistency, consistency_years, avg_roe, avg_margin, fetched_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(ticker) DO UPDATE SET
        cik = excluded.cik, capital_intensity = excluded.capital_intensity,
        capital_intensity_label = excluded.capital_intensity_label,
        earnings_consistency = excluded.earnings_consistency,
        consistency_years = excluded.consistency_years,
        avg_roe = excluded.avg_roe, avg_margin = excluded.avg_margin,
        fetched_at = excluded.fetched_at
    `).run(symbol, cik, capitalIntensity, capitalIntensityLabel, earningsConsistency, consistencyYears, avgRoe, avgMargin, fetched_at);

    return {
      capitalIntensity:      capitalIntensity?.toFixed(1)   ?? null,
      capitalIntensityLabel: capitalIntensityLabel           ?? null,
      earningsConsistency:   earningsConsistency             ?? null,
      consistencyYears,
      avgRoe:                avgRoe?.toFixed(1)   ?? null,
      avgMargin:             avgMargin?.toFixed(1) ?? null,
    };
  } catch (e) {
    console.error(`[secMunger] ${symbol}:`, e);
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const [reuters, finviz, extendedMarket] = await Promise.all([
    scrapeReuters(symbol),
    scrapeFinviz(symbol),
    fetchExtendedMarket(symbol),
  ]);

  const intrinsicValue  = calcIntrinsicValue(finviz?.stats ?? {});
  const netCashPerShare = calcNetCash(finviz?.stats ?? {});
  const { debtToRevenue, debtToEbitda } = calcDebtMetrics(finviz?.stats ?? {});
  const dividendMetrics = calcDividendMetrics(finviz?.stats ?? {});
  const moatQuality     = calcMoatQuality(finviz?.stats ?? {});
  const insiderActivity = calcInsiderActivity(finviz?.stats ?? {});
  const growthMetrics   = calcGrowthMetrics(finviz?.stats ?? {});
  const riskProfile     = computeRiskProfile(finviz?.sector ?? "", finviz?.description || reuters.description);
  const rateSensitivity = computeRateSensitivity(finviz?.sector ?? "");

  // EV/EBITDA and FCF Yield — already in Finviz stats
  const parseVal = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
  const evEbitda = finviz?.stats?.["EV/EBITDA"] ?? "";
  const pfcfRaw  = finviz?.stats?.["P/FCF"] ?? "";
  const pfcfN    = parseVal(pfcfRaw);
  const fcfYield = pfcfN > 0 ? parseFloat((100 / pfcfN).toFixed(2)) : null;

  const hasReutersData =
    reuters.financials.incomeStatement.length ||
    reuters.financials.balanceSheet.length ||
    reuters.financials.cashFlow.length;

  const fcfConversion = calcFCFConversion(finviz?.stats ?? {});
  const secFin = await fetchSecMungerData(symbol);
  const mungerMetrics = {
    fcfConversion,
    capitalIntensity:      secFin?.capitalIntensity      ?? null,
    capitalIntensityLabel: secFin?.capitalIntensityLabel ?? null,
    earningsConsistency:   secFin?.earningsConsistency   ?? null,
    consistencyYears:      secFin?.consistencyYears      ?? 0,
    avgRoe:                secFin?.avgRoe                ?? null,
    avgMargin:             secFin?.avgMargin             ?? null,
  };

  const quality = { moatQuality, insiderActivity, riskProfile, rateSensitivity, growthMetrics };
  const valuationExtras = { evEbitda, fcfYield, sector: finviz?.sector ?? "" };

  if (hasReutersData) {
    return NextResponse.json({
      ticker: symbol,
      ...reuters,
      price: finviz?.price || reuters.price,
      description: finviz?.description || reuters.description,
      intrinsicValue, netCashPerShare,
      debtToRevenue, debtToEbitda, dividendMetrics,
      extendedMarket, mungerMetrics,
      ...valuationExtras,
      ...quality,
    });
  }

  if (finviz) {
    const { stats: _, ...finvizWithoutStats } = finviz;
    return NextResponse.json({
      ticker: symbol,
      ...finvizWithoutStats,
      priceChange: "",
      intrinsicValue, netCashPerShare,
      debtToRevenue, debtToEbitda, dividendMetrics,
      extendedMarket, mungerMetrics,
      ...valuationExtras,
      ...quality,
    });
  }

  return NextResponse.json({
    ticker: symbol,
    price: "",
    priceChange: "",
    description: "",
    financials: { incomeStatement: [], balanceSheet: [], cashFlow: [] },
    intrinsicValue, netCashPerShare: "",
    dividendMetrics: null,
    debtToRevenue: "",
    debtToEbitda: "",
    extendedMarket: null,
    mungerMetrics: null,
    ...valuationExtras,
    ...quality,
  });
}
