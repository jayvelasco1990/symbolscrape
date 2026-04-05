import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface MomentumResult {
  ticker: string;
  score: number;
  label: "Strong" | "Moderate" | "Weak" | "Bearish";
  rsi: number | null;
  sma50Pct: number | null;
  sma200Pct: number | null;
  roc1m: number | null;
}

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

function scoreComponents(rsi: number | null, sma50Pct: number | null, sma200Pct: number | null, roc1m: number | null): number {
  let score = 0;

  // SMA50: above = 25pts
  if (sma50Pct != null && sma50Pct > 0) score += 25;

  // SMA200: above = 25pts
  if (sma200Pct != null && sma200Pct > 0) score += 25;

  // RSI: sweet spot 45–70 = 25pts, extended 70–80 or recovering 35–45 = 15pts, else 5pts
  if (rsi != null) {
    if (rsi >= 45 && rsi <= 70) score += 25;
    else if ((rsi > 70 && rsi <= 80) || (rsi >= 35 && rsi < 45)) score += 15;
    else score += 5;
  }

  // 1M ROC: >3% = 25pts, 0–3% = 17pts, -3 to 0% = 8pts, <-3% = 0pts
  if (roc1m != null) {
    if (roc1m > 3) score += 25;
    else if (roc1m > 0) score += 17;
    else if (roc1m > -3) score += 8;
  }

  return score;
}

function labelFromScore(score: number): "Strong" | "Moderate" | "Weak" | "Bearish" {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Moderate";
  if (score >= 25) return "Weak";
  return "Bearish";
}

async function fetchMomentum(ticker: string): Promise<Omit<MomentumResult, "ticker"> | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&includePrePost=false`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const closes: number[] = (result.indicators?.quote?.[0]?.close ?? [])
      .filter((c: unknown): c is number => typeof c === "number" && c != null);

    if (closes.length < 20) return null;

    const last = closes[closes.length - 1];

    // SMA50 and SMA200
    const last50  = closes.slice(-50);
    const last200 = closes.slice(-200);
    const sma50   = last50.length  >= 20 ? last50.reduce((a, b)  => a + b, 0) / last50.length  : null;
    const sma200  = last200.length >= 20 ? last200.reduce((a, b) => a + b, 0) / last200.length : null;
    const sma50Pct  = sma50  ? parseFloat(((last / sma50  - 1) * 100).toFixed(2)) : null;
    const sma200Pct = sma200 ? parseFloat(((last / sma200 - 1) * 100).toFixed(2)) : null;

    // RSI(14)
    const rsi = computeRSI(closes);

    // 1M ROC (~22 trading days)
    const prev1m = closes[Math.max(0, closes.length - 22)];
    const roc1m = prev1m ? parseFloat(((last / prev1m - 1) * 100).toFixed(2)) : null;

    const score = scoreComponents(rsi, sma50Pct, sma200Pct, roc1m);
    const label = labelFromScore(score);

    return { score, label, rsi, sma50Pct, sma200Pct, roc1m };
  } catch {
    return null;
  }
}

export async function GET() {
  const db = getDb();
  const watchlist = db.prepare("SELECT ticker FROM watchlist").all() as { ticker: string }[];
  if (watchlist.length === 0) return NextResponse.json([]);

  const now = Date.now();
  const results: MomentumResult[] = [];
  const needsFetch: string[] = [];

  for (const { ticker } of watchlist) {
    const cached = db
      .prepare("SELECT score, label, rsi, sma50_pct, sma200_pct, roc1m, fetched_at FROM momentum_cache WHERE ticker = ?")
      .get(ticker) as { score: number; label: string; rsi: number | null; sma50_pct: number | null; sma200_pct: number | null; roc1m: number | null; fetched_at: string } | undefined;

    if (cached && now - new Date(cached.fetched_at + "Z").getTime() < TTL_MS) {
      results.push({
        ticker,
        score: cached.score,
        label: cached.label as MomentumResult["label"],
        rsi: cached.rsi,
        sma50Pct: cached.sma50_pct,
        sma200Pct: cached.sma200_pct,
        roc1m: cached.roc1m,
      });
    } else {
      needsFetch.push(ticker);
    }
  }

  if (needsFetch.length > 0) {
    const fetched = await Promise.all(needsFetch.map(fetchMomentum));
    const fetched_at = new Date().toISOString().replace("T", " ").split(".")[0];
    const upsert = db.prepare(
      `INSERT INTO momentum_cache (ticker, score, label, rsi, sma50_pct, sma200_pct, roc1m, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ticker) DO UPDATE SET score=excluded.score, label=excluded.label,
         rsi=excluded.rsi, sma50_pct=excluded.sma50_pct, sma200_pct=excluded.sma200_pct,
         roc1m=excluded.roc1m, fetched_at=excluded.fetched_at`
    );

    needsFetch.forEach((ticker, i) => {
      const m = fetched[i];
      if (m) {
        upsert.run(ticker, m.score, m.label, m.rsi, m.sma50Pct, m.sma200Pct, m.roc1m, fetched_at);
        results.push({ ticker, ...m });
      } else {
        results.push({ ticker, score: 0, label: "Weak", rsi: null, sma50Pct: null, sma200Pct: null, roc1m: null });
      }
    });
  }

  return NextResponse.json(results);
}
