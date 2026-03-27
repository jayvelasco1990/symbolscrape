import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — revenue only changes quarterly
const SEC_HEADERS = {
  "User-Agent": "vpfund/1.0 admin@vpfund.com",
  Accept: "application/json",
};

export interface RevenueQuarter {
  label: string;       // "Q3 '24"
  revenue: number;     // raw USD value
  growthPct: number | null; // YoY %
}

async function getCik(ticker: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-Q&dateb=&owner=include&count=5&search_text=`,
      { headers: { "User-Agent": "vpfund/1.0 admin@vpfund.com", Accept: "text/html" } }
    );
    if (!res.ok) return null;
    const html = await res.text();
    // CIK appears in URLs like ?action=getcompany&CIK=0000320193
    const m = html.match(/CIK=0*(\d+)/);
    return m ? m[1].padStart(10, "0") : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickRevenueConcept(usgaap: Record<string, any>): any[] {
  const concepts = [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueGoodsNet",
    "RevenueFromContractWithCustomer",
  ];
  for (const c of concepts) {
    const entries = usgaap[c]?.units?.USD;
    if (Array.isArray(entries) && entries.length > 0) return entries;
  }
  return [];
}

function formatLabel(fp: string, fy: number): string {
  return `${fp} '${String(fy).slice(2)}`;
}

function fmtRevenue(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

async function fetchFromEdgar(ticker: string): Promise<RevenueQuarter[] | null> {
  const cik = await getCik(ticker);
  if (!cik) return null;

  let factsData: unknown;
  try {
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      { headers: SEC_HEADERS }
    );
    if (!res.ok) return null;
    factsData = await res.json();
  } catch {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usgaap = (factsData as any)?.facts?.["us-gaap"];
  if (!usgaap) return null;

  const allEntries = pickRevenueConcept(usgaap);
  if (!allEntries.length) return null;

  // Keep only single-quarter 10-Q entries (period ~3 months)
  const quarterly = allEntries.filter((e) => {
    if (e.form !== "10-Q") return false;
    if (!e.start || !e.end) return false;
    const days =
      (new Date(e.end).getTime() - new Date(e.start).getTime()) / 86_400_000;
    return days >= 75 && days <= 105;
  });

  if (!quarterly.length) return null;

  // Deduplicate first by end date, then by (fp, fy) — keep latest-filed for each period
  const byEnd: Record<string, typeof quarterly[0]> = {};
  for (const e of quarterly) {
    if (!byEnd[e.end] || e.filed > byEnd[e.end].filed) byEnd[e.end] = e;
  }

  const byPeriod: Record<string, typeof quarterly[0]> = {};
  for (const e of Object.values(byEnd)) {
    const key = `${e.fp}-${e.fy}`;
    if (!byPeriod[key] || e.filed > byPeriod[key].filed) byPeriod[key] = e;
  }

  const sorted = Object.values(byPeriod).sort((a, b) => a.end.localeCompare(b.end));
  const recent = sorted.slice(-10); // keep up to 10 quarters for YoY calc

  // Calculate YoY growth (compare to same quarter one year prior)
  return recent.slice(-8).map((q) => {
    const idx = sorted.indexOf(q);
    // Look for the entry ~4 quarters back (same fp, fy-1)
    const priorEntry = sorted.find(
      (e) => e.fp === q.fp && e.fy === q.fy - 1
    ) ?? (idx >= 4 ? sorted[idx - 4] : null);

    const growthPct =
      priorEntry && priorEntry.val > 0
        ? parseFloat((((q.val - priorEntry.val) / priorEntry.val) * 100).toFixed(1))
        : null;

    return {
      label: formatLabel(q.fp, q.fy),
      revenue: q.val,
      revenueFormatted: fmtRevenue(q.val),
      growthPct,
    };
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const db = getDb();
  const now = Date.now();

  const cached = db
    .prepare("SELECT data, fetched_at FROM revenue_cache WHERE ticker = ?")
    .get(ticker) as { data: string; fetched_at: string } | undefined;

  if (cached && now - new Date(cached.fetched_at + "Z").getTime() < TTL_MS) {
    return NextResponse.json(JSON.parse(cached.data));
  }

  const quarters = await fetchFromEdgar(ticker);
  if (!quarters) {
    return NextResponse.json({ quarters: [] });
  }

  const payload = { quarters };
  const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
  db.prepare(
    `INSERT INTO revenue_cache (ticker, data, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`
  ).run(ticker, JSON.stringify(payload), fetched_at);

  return NextResponse.json(payload);
}
