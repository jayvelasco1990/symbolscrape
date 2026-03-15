import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS = path.join(__dirname, "../docs/screenshots");
const OUT = path.join(__dirname, "../docs/vpfund-marketing.pdf");

function img(name) {
  const buf = readFileSync(path.join(SS, `${name}.png`));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18181b; background: #fff; }

  /* ── Cover ── */
  .cover {
    height: 100vh;
    background: linear-gradient(135deg, #0f0f11 0%, #1a1033 60%, #0f172a 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 60px; text-align: center;
    position: relative; overflow: hidden;
  }
  .cover::before {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 20%, rgba(99,102,241,0.25), transparent);
  }
  .cover-badge {
    position: relative;
    display: inline-block;
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: #a5b4fc; border: 1px solid #3730a3;
    background: rgba(99,102,241,0.12);
    padding: 6px 16px; border-radius: 999px; margin-bottom: 28px;
  }
  .cover h1 {
    position: relative;
    font-size: 72px; font-weight: 800; letter-spacing: -2px; line-height: 1.05;
    color: #f4f4f5; margin-bottom: 12px;
  }
  .cover h1 span { color: #818cf8; }
  .cover-sub {
    position: relative;
    font-size: 20px; color: #a1a1aa; max-width: 520px; line-height: 1.6; margin-bottom: 48px;
  }
  .cover-pills {
    position: relative;
    display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
  }
  .pill {
    font-size: 12px; font-weight: 600; color: #c7d2fe;
    background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3);
    padding: 6px 14px; border-radius: 8px;
  }
  .cover-footer {
    position: absolute; bottom: 32px; left: 0; right: 0;
    text-align: center; font-size: 11px; color: #52525b;
  }

  /* ── Pages ── */
  .page {
    padding: 56px 60px;
    min-height: 100vh;
    page-break-after: always;
  }
  .page-light { background: #fff; }
  .page-dark  { background: #09090b; color: #f4f4f5; }
  .page-muted { background: #fafafa; }

  .eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: #6366f1; margin-bottom: 8px;
  }
  .page-dark .eyebrow { color: #818cf8; }

  h2 { font-size: 34px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 10px; }
  .page-dark h2 { color: #f4f4f5; }

  .lead { font-size: 15px; color: #71717a; line-height: 1.7; max-width: 580px; margin-bottom: 40px; }
  .page-dark .lead { color: #a1a1aa; }

  /* feature grid */
  .features { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 0; }
  .feat {
    background: #fff; border: 1px solid #e4e4e7;
    border-radius: 14px; padding: 22px;
  }
  .page-dark .feat { background: #18181b; border-color: #27272a; }
  .feat-icon { font-size: 22px; margin-bottom: 10px; }
  .feat h3 { font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #18181b; }
  .page-dark .feat h3 { color: #f4f4f5; }
  .feat p  { font-size: 12px; color: #71717a; line-height: 1.6; }
  .page-dark .feat p { color: #a1a1aa; }

  /* screenshot */
  .ss { width: 100%; border-radius: 12px; border: 1px solid #e4e4e7; display: block; margin-bottom: 16px; }
  .page-dark .ss { border-color: #27272a; }
  .ss-caption { font-size: 11px; color: #a1a1aa; text-align: center; margin-bottom: 32px; }

  .ss-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .ss-grid .ss { margin-bottom: 6px; }

  /* formula box */
  .formula {
    background: #f4f4f5; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px;
  }
  .page-dark .formula { background: #18181b; }
  .formula code {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 13px; line-height: 2; color: #6366f1; display: block;
  }
  .formula-label { font-size: 11px; color: #71717a; margin-top: 8px; }

  /* two-col */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }

  /* stat cards */
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
  .stat {
    border-radius: 12px; padding: 20px;
    background: linear-gradient(135deg, #eef2ff, #e0e7ff);
    border: 1px solid #c7d2fe;
  }
  .stat-val { font-size: 28px; font-weight: 800; color: #4338ca; }
  .stat-lbl { font-size: 11px; color: #6366f1; font-weight: 600; margin-top: 4px; }

  /* divider */
  hr { border: none; border-top: 1px solid #e4e4e7; margin: 32px 0; }
  .page-dark hr { border-color: #27272a; }

  /* stack row */
  .stack-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 32px; }
  .tag {
    font-size: 11px; font-weight: 600; color: #6366f1;
    background: #eef2ff; border: 1px solid #c7d2fe;
    padding: 5px 12px; border-radius: 6px;
  }

  /* back cover */
  .backcover {
    height: 100vh;
    background: #09090b;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center; padding: 60px;
  }
  .backcover h2 { font-size: 42px; font-weight: 800; color: #f4f4f5; margin-bottom: 16px; }
  .backcover p  { font-size: 16px; color: #71717a; max-width: 480px; line-height: 1.7; margin-bottom: 40px; }
  .backcover .disclaimer { font-size: 11px; color: #3f3f46; position: absolute; bottom: 32px; }
</style>
</head>
<body>

<!-- ══ COVER ══════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-badge">Value Investing Toolkit</div>
  <h1>vp<span>fund</span></h1>
  <p class="cover-sub">
    Screen dividend stocks, calculate intrinsic value, track your portfolio,
    and benchmark performance against SPY — all self-hosted, no subscriptions.
  </p>
  <div class="cover-pills">
    <span class="pill">Stock Screener</span>
    <span class="pill">Graham Number</span>
    <span class="pill">Debt Analysis</span>
    <span class="pill">Watchlist</span>
    <span class="pill">Portfolio vs SPY</span>
    <span class="pill">Diversification Score</span>
  </div>
  <div class="cover-footer">For informational purposes only · Not financial advice</div>
</div>

<!-- ══ PAGE 1 — Overview ══════════════════════════════════════════ -->
<div class="page page-light">
  <div class="eyebrow">Overview</div>
  <h2>A complete research toolkit<br/>for value investors</h2>
  <p class="lead">
    vpfund brings together stock screening, fundamental analysis, and portfolio
    tracking in a single self-hosted application. No API keys. No paywalls.
    Just open-source tooling built on real-time data from Finviz and Reuters.
  </p>

  <div class="stats">
    <div class="stat"><div class="stat-val">3</div><div class="stat-lbl">Market Cap Tiers</div></div>
    <div class="stat"><div class="stat-val">6</div><div class="stat-lbl">Performance Periods</div></div>
    <div class="stat"><div class="stat-val">0</div><div class="stat-lbl">Subscriptions Required</div></div>
  </div>

  <div class="features">
    <div class="feat"><div class="feat-icon">◈</div><h3>Multi-Cap Screening</h3><p>Mega, Large, and Small cap tiers with optional dividend and RSI filters, sorted by P/E ratio.</p></div>
    <div class="feat"><div class="feat-icon">⬡</div><h3>Graham Number</h3><p>√(22.5 × EPS × Book/sh) — Benjamin Graham's conservative fair value formula, calculated live.</p></div>
    <div class="feat"><div class="feat-icon">◎</div><h3>Debt & Leverage</h3><p>Debt/Revenue and Debt/EBITDA derived from Finviz snapshot data with four-tier risk badges.</p></div>
    <div class="feat"><div class="feat-icon">◐</div><h3>Dividend Analysis</h3><p>Payout ratio and FCF coverage scored for sustainability with plain-English verdict.</p></div>
    <div class="feat"><div class="feat-icon">◑</div><h3>Watchlist & Portfolio</h3><p>Track positions with quantity and market value, persisted locally in SQLite.</p></div>
    <div class="feat"><div class="feat-icon">◍</div><h3>Diversification Score</h3><p>HHI-based 0–100 score with effective position count and collapsible formula explanation.</p></div>
  </div>
</div>

<!-- ══ PAGE 2 — Screener ══════════════════════════════════════════ -->
<div class="page page-muted">
  <div class="eyebrow">Stock Screener</div>
  <h2>Find value candidates<br/>in seconds</h2>
  <p class="lead">Three market cap tiers, filterable by dividend yield and RSI, sorted by P/E. Click any ticker to open its full analysis.</p>

  <img class="ss" src="${img("screener")}" />
  <p class="ss-caption">Stock Screener — Mega Cap tab, sorted by P/E with dividend filter active</p>

  <div class="features" style="grid-template-columns:1fr 1fr 1fr; margin-top:0;">
    <div class="feat"><h3>Mega Cap</h3><p>Market cap &gt; $200B — the largest, most liquid names.</p></div>
    <div class="feat"><h3>Large Cap</h3><p>$10B–$200B US stocks with low beta.</p></div>
    <div class="feat"><h3>Small Cap</h3><p>$300M–$2B US stocks with oversold RSI candidates.</p></div>
  </div>
</div>

<!-- ══ PAGE 3 — Stock Detail ══════════════════════════════════════ -->
<div class="page page-light">
  <div class="eyebrow">Stock Detail</div>
  <h2>Every metric you need<br/>on one page</h2>
  <p class="lead">Click any ticker to see intrinsic value, margin of safety, debt ratios, dividend sustainability, and full financials.</p>

  <div class="ss-grid">
    <div>
      <img class="ss" src="${img("stock-detail")}" />
      <p class="ss-caption">Full stock detail page</p>
    </div>
    <div>
      <img class="ss" src="${img("intrinsic-value")}" />
      <p class="ss-caption">Graham Number & Margin of Safety</p>
    </div>
  </div>

  <img class="ss" src="${img("debt-metrics")}" />
  <p class="ss-caption">Debt/Revenue and Debt/EBITDA with color-coded risk tiers</p>
</div>

<!-- ══ PAGE 4 — Formulas ══════════════════════════════════════════ -->
<div class="page page-dark">
  <div class="eyebrow">Methodology</div>
  <h2>Transparent formulas,<br/>no black boxes</h2>
  <p class="lead">Every number on the page is derived from a published formula using raw data from Finviz. No proprietary scoring.</p>

  <div class="two-col">
    <div>
      <p style="font-size:13px;font-weight:700;color:#a5b4fc;margin-bottom:10px;">Intrinsic Value (Graham Number)</p>
      <div class="formula">
        <code>Graham Number = √(22.5 × EPS × Book/sh)</code>
        <code>Margin of Safety = (Graham − Price) / Graham × 100</code>
        <div class="formula-label">Source: Benjamin Graham, The Intelligent Investor</div>
      </div>

      <p style="font-size:13px;font-weight:700;color:#a5b4fc;margin-bottom:10px;">Debt Metrics</p>
      <div class="formula">
        <code>Total Equity  = Book/sh × Shares Outstanding</code>
        <code>Total Debt    = Debt/Eq × Total Equity</code>
        <code>Debt/Revenue  = Total Debt ÷ Sales</code>
        <code>Debt/EBITDA   = Total Debt ÷ (EV ÷ EV/EBITDA)</code>
        <div class="formula-label">Inputs: Finviz snapshot table</div>
      </div>
    </div>
    <div>
      <p style="font-size:13px;font-weight:700;color:#a5b4fc;margin-bottom:10px;">Diversification Score (HHI)</p>
      <div class="formula">
        <code>wᵢ    = position value / total portfolio value</code>
        <code>HHI   = Σ wᵢ²</code>
        <code>ENP   = 1 / HHI</code>
        <code>Score = min(ENP / 20, 1) × 100</code>
        <div class="formula-label">Lower HHI = more diversified. ENP = effective equal-weight positions.</div>
      </div>

      <p style="font-size:13px;font-weight:700;color:#a5b4fc;margin-bottom:10px;">Dividend Sustainability</p>
      <div class="formula">
        <code>FCF/sh      = Price ÷ P/FCF</code>
        <code>FCF Coverage = FCF/sh ÷ Annual Dividend</code>
        <div class="formula-label">Healthy: payout ≤ 60% and FCF coverage ≥ 1.2×</div>
      </div>
    </div>
  </div>
</div>

<!-- ══ PAGE 5 — Watchlist & Performance ══════════════════════════ -->
<div class="page page-muted">
  <div class="eyebrow">Portfolio Tracking</div>
  <h2>Watchlist, performance,<br/>and diversification</h2>
  <p class="lead">Save stocks, set quantities, and see how your portfolio compares to SPY across six time periods — all calculated on-demand and cached locally.</p>

  <div class="ss-grid">
    <div>
      <img class="ss" src="${img("watchlist")}" />
      <p class="ss-caption">Watchlist with position value and diversification score</p>
    </div>
    <div>
      <img class="ss" src="${img("performance-breakdown")}" />
      <p class="ss-caption">Per-stock performance breakdown vs SPY benchmark</p>
    </div>
  </div>

  <div class="features" style="grid-template-columns:1fr 1fr 1fr; margin-top:8px;">
    <div class="feat"><h3>Market Value</h3><p>quantity × price per position, totalled at the bottom of the table.</p></div>
    <div class="feat"><h3>Portfolio vs SPY</h3><p>Value-weighted returns over 1W, 1M, 3M, 6M, 1Y, YTD — cached 6 hours.</p></div>
    <div class="feat"><h3>Heatmap Breakdown</h3><p>Each stock's return per period, color-coded by magnitude with SPY delta toggle.</p></div>
  </div>
</div>

<!-- ══ PAGE 6 — Tech Stack ════════════════════════════════════════ -->
<div class="page page-light">
  <div class="eyebrow">Technology</div>
  <h2>Built on modern,<br/>open-source tooling</h2>
  <p class="lead">Self-hosted, zero external dependencies at runtime. All data scraped server-side on demand. SQLite for local persistence.</p>

  <div class="stack-row">
    <span class="tag">Next.js 16 App Router</span>
    <span class="tag">React 19</span>
    <span class="tag">TypeScript 5</span>
    <span class="tag">Tailwind CSS v4</span>
    <span class="tag">TanStack Table v8</span>
    <span class="tag">Recharts</span>
    <span class="tag">Cheerio</span>
    <span class="tag">better-sqlite3</span>
    <span class="tag">Node.js 22</span>
    <span class="tag">pnpm</span>
  </div>

  <hr/>

  <div class="two-col">
    <div>
      <p style="font-size:13px;font-weight:700;color:#18181b;margin-bottom:12px;">Data Sources</p>
      <div class="feat" style="margin-bottom:12px;">
        <h3>Finviz</h3>
        <p>Price, EPS, Book value, Debt/Equity, Sales, EV, EV/EBITDA, P/FCF, Dividend TTM, payout ratio, performance stats, screener results.</p>
      </div>
      <div class="feat">
        <h3>Reuters</h3>
        <p>Supplementary Income Statement, Balance Sheet, and Cash Flow tables when available.</p>
      </div>
    </div>
    <div>
      <p style="font-size:13px;font-weight:700;color:#18181b;margin-bottom:12px;">Architecture</p>
      <div class="feat" style="margin-bottom:12px;">
        <h3>Server-side scraping</h3>
        <p>All Finviz and Reuters requests run in Next.js API routes. The browser never touches external domains.</p>
      </div>
      <div class="feat">
        <h3>SQLite persistence</h3>
        <p>Watchlist, performance cache, and messages stored in a local <code style="font-size:11px;background:#f4f4f5;padding:1px 4px;border-radius:4px;">data/vpfund.db</code> file. No cloud database required.</p>
      </div>
    </div>
  </div>
</div>

<!-- ══ BACK COVER ═════════════════════════════════════════════════ -->
<div class="backcover">
  <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6366f1;margin-bottom:20px;">Value Investing Toolkit</div>
  <h2 style="color:#f4f4f5;">vpfund</h2>
  <p>Self-hosted. Open source. No subscriptions.<br/>Built for investors who want to understand the numbers.</p>
  <div style="display:flex;gap:12px;justify-content:center;">
    <span class="pill">localhost:3000</span>
    <span class="pill">pnpm dev</span>
  </div>
  <div class="disclaimer">Data sourced from Finviz &amp; Reuters · For informational purposes only · Not financial advice</div>
</div>

</body>
</html>`;

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});

await browser.close();
console.log(`✓ PDF saved to docs/vpfund-marketing.pdf`);
