<div align="center">

# vpfund

**A self-hosted value investing toolkit — screen stocks, track a watchlist, and measure portfolio performance vs SPY.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TanStack Table](https://img.shields.io/badge/TanStack_Table-8-FF4154?style=flat-square)](https://tanstack.com/table)

</div>

---

## Screenshots

| Landing Page | Stock Screener |
|:---:|:---:|
| ![Landing](docs/screenshots/landing.png) | ![Screener](docs/screenshots/screener.png) |

| Stock Detail | Intrinsic Value |
|:---:|:---:|
| ![Stock Detail](docs/screenshots/stock-detail.png) | ![Intrinsic Value](docs/screenshots/intrinsic-value.png) |

| Watchlist | Performance Breakdown |
|:---:|:---:|
| ![Watchlist](docs/screenshots/watchlist.png) | ![Performance Breakdown](docs/screenshots/performance-breakdown.png) |

![Debt Metrics](docs/screenshots/debt-metrics.png)

---

## What is vpfund?

vpfund is a self-hosted stock research tool built for value investors. Screen dividend-paying stocks across market cap tiers, calculate the **Graham Number**, analyze leverage, and track a personal watchlist — all backed by a local SQLite database and scraped in real time from Finviz and Reuters.

No subscriptions. No API keys. No paywalls.

---

## Features

### Stock Screener
- Three market cap tiers — **Mega Cap** (>$200B), **Large Cap** ($10B–$200B), **Small Cap** ($300M–$2B)
- Pre-filtered for **dividend-paying** stocks with **low beta** and **RSI below 50** (oversold value candidates)
- Sortable columns via TanStack Table with **20-record pagination**
- URL-persisted tab and page state — hitting browser back restores exactly where you were
- Click any ticker to open its detail page — price passes through the URL for instant display

### Intrinsic Value (Graham Number)
- Calculates `√(22.5 × EPS × Book/sh)` for every stock using live Finviz data
- Shows **Stock Price**, **Graham Number**, and **Margin of Safety** side by side
- Color-coded card — green when undervalued, red when overvalued
- Progress bar showing where the current price sits relative to fair value

### Debt Metrics
- **Debt / Revenue** derived from `Debt/Eq × Book/sh × Shares Outstanding ÷ Sales`
- **Debt / EBITDA** derived from `Total Debt ÷ (Enterprise Value ÷ EV/EBITDA)`
- Four-tier risk badge per metric: `Conservative` · `Moderate` · `Elevated` · `High Leverage`
- Animated progress bars scaled to meaningful thresholds

### Stock Detail Page
- Price, company description (always sourced from Finviz for consistency)
- Income Statement, Balance Sheet, and Cash Flow from Finviz snapshot stats
- Supplementary financial tables from Reuters when available

### Symbol Lookup
- Search any ticker from the navbar — independent of the screener
- Navigates directly to the stock detail page with all metrics populated

### Watchlist
- Add any stock to your watchlist directly from the detail page with one click
- Enter share quantities to track **position size** and **total market value**
- Inline quantity editing — type and press Enter or click away to save
- Persisted to a local **SQLite** database via `better-sqlite3`

### Portfolio vs SPY Performance
- Compares your watchlist portfolio against the **SPY benchmark** across 6 time periods: 1W, 1M, 3M, 6M, 1Y, YTD
- **Value-weighted** by position size when quantities are set; falls back to equal-weight
- Results cached in SQLite for 6 hours — recalculated on each page visit after cache expires
- Grouped bar chart (Portfolio in indigo, SPY in amber) with a custom hover tooltip

### Performance Breakdown
- Per-stock heatmap table — each row is a position, each column a time period
- Cells color-coded by return magnitude (two shades of green/red)
- Toggle **vs SPY delta** to show how each stock beats or lags the benchmark per period
- Sortable by any period or portfolio weight
- SPY benchmark row pinned at the bottom for direct comparison

### Diversification Score
- Calculates a **0–100 score** using the Herfindahl-Hirschman Index (HHI)
- Shows **HHI**, **Effective Number of Positions (ENP)**, top holding %, and top-3 concentration %
- Four verdicts: Well Diversified · Moderately Diversified · Concentrated · Highly Concentrated
- Collapsible formula explanation with step-by-step breakdown inline on the page

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Table | TanStack Table v8 |
| Charts | Recharts |
| Scraping | Cheerio (server-side) |
| Database | SQLite via better-sqlite3 |
| Data Sources | Finviz, Reuters |
| Runtime | Node.js 22 |
| Package Manager | pnpm |

---

## Getting Started

### Prerequisites

This project requires **Node.js 22** and **pnpm**. Follow the steps for your OS.

---

#### macOS / Linux

**1. Install nvm**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Restart your terminal, then:

```bash
nvm install 22
nvm use 22
node --version  # v22.x.x
```

**Auto-switching (recommended):** Add to your `~/.zshrc` (zsh) or `~/.bash_profile` (bash):

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# zsh only — auto-switch node version on cd
autoload -U add-zsh-hook
load-nvmrc() {
  local nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")
    if [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use --silent
    fi
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

With this in place, `cd vpfund` will automatically switch to Node 22.

---

#### Windows

**1. Install nvm-windows**

Download and run the installer from [github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases) (`nvm-setup.exe`).

Open a new terminal (PowerShell or CMD as Administrator), then:

```powershell
nvm install 22
nvm use 22
node --version  # v22.x.x
```

> **Windows build tools:** `better-sqlite3` compiles a native module. You may need to install build tools first:
> ```powershell
> npm install -g windows-build-tools
> ```
> Or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and select **"Desktop development with C++"**.

---

**2. Install pnpm (all platforms)**

```bash
npm install -g pnpm
```

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/vpfund.git
cd vpfund

# Install dependencies (ensure Node 22 is active first)
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** The project enforces Node 22+ via `.npmrc`. Running `pnpm install` with an older Node version will fail with a clear error.

---

## Project Structure

```
vpfund/
├── app/
│   ├── page.tsx                         # Marketing landing page
│   ├── screener/
│   │   └── page.tsx                     # Stock screener (Mega/Large/Small cap tabs)
│   ├── stocks/
│   │   └── [ticker]/
│   │       └── page.tsx                 # Stock detail page
│   ├── watchlist/
│   │   ├── page.js                      # Watchlist with market value + diversification score
│   │   └── performance/
│   │       └── page.js                  # Per-stock performance breakdown vs SPY
│   ├── api/
│   │   ├── stocks/
│   │   │   ├── route.ts                 # Finviz screener endpoint
│   │   │   └── [ticker]/quote/
│   │   │       └── route.ts             # Quote + intrinsic value + debt metrics
│   │   ├── watchlist/
│   │   │   └── route.js                 # GET / POST / PATCH / DELETE watchlist
│   │   └── performance/
│   │       └── route.ts                 # Portfolio vs SPY performance (6hr cached)
│   └── components/
│       ├── NavBar.tsx                   # Sticky nav with symbol search
│       ├── SymbolSearch.tsx             # Ticker lookup input
│       ├── StocksTable.tsx              # Sortable, paginated screener table
│       ├── StockDetail.tsx              # Stock detail orchestrator
│       ├── IntrinsicValue.tsx           # Graham Number card with progress bar
│       ├── DebtMetrics.tsx              # Debt/Revenue + Debt/EBITDA cards
│       ├── DividendMetrics.tsx          # Dividend sustainability analysis
│       ├── WatchlistButton.tsx          # Add/remove watchlist toggle
│       ├── PerformanceChart.tsx         # Recharts grouped bar chart (Portfolio vs SPY)
│       └── DiversificationScore.tsx     # HHI-based diversification card
├── lib/
│   └── db.js                            # SQLite singleton (better-sqlite3)
```

---

## How Intrinsic Value is Calculated

The **Graham Number** is a formula by Benjamin Graham estimating the maximum fair price of a stock:

```
Graham Number = √(22.5 × EPS (ttm) × Book Value per Share)
```

**Margin of Safety** measures how far the current price is below that fair value:

```
Margin of Safety = (Graham Number − Price) / Graham Number × 100
```

A positive margin means the stock trades **below** intrinsic value — a classic value signal.

---

## How Debt Metrics are Calculated

All inputs come from the Finviz snapshot table:

```
Total Equity   = Book/sh × Shares Outstanding
Total Debt     = Debt/Eq × Total Equity

Debt / Revenue = Total Debt ÷ Sales
Debt / EBITDA  = Total Debt ÷ (Enterprise Value ÷ EV/EBITDA)
```

---

## Data Sources

| Source | Used For |
|---|---|
| [Finviz](https://finviz.com) | Price, stats, description, screener results, debt inputs |
| [Reuters](https://reuters.com) | Supplementary financial statement tables |

> Data is scraped in real time on each request. This tool is for personal/informational use only and is not financial advice.

---

## How Diversification is Calculated

```
wᵢ     = (price × quantity) / total portfolio value
HHI    = Σ wᵢ²
ENP    = 1 / HHI
Score  = min(ENP / 20, 1) × 100
```

A portfolio of 20 perfectly equal positions scores **100**. A single position scores **5**. Falls back to equal-weighting if no quantities are set.

---

## Roadmap

### Portfolio
- [ ] Price refresh on watchlist (update stored price to current market price)
- [ ] Export watchlist to CSV
- [ ] DCF calculator
- [ ] Financial charts (revenue, earnings, cash flow over time)

### Watchlist Report & Export
A single-page report covering every position in your watchlist — useful for weekly review or printing to PDF before a weekend deep-dive.

#### Report page (`/watchlist/report`)
- [ ] Summary strip: total portfolio value, weighted avg return vs SPY (all periods), diversification score, and count of Strong Buy / Buy / Neutral / Avoid signals across positions
- [ ] Per-position table: Ticker · Shares · Market Value · Weight % · Signal badge · Moat Quality · Debt/EBITDA · Dividend Yield · 1W / 1M / YTD return vs SPY delta
- [ ] Sector allocation breakdown: pie or bar chart showing % weight per sector
- [ ] Flagged positions panel: any stock with signal = Avoid, Moat = Weak, or Debt/EBITDA > 4.0 listed with the specific reason
- [ ] Print-friendly layout: `@media print` CSS hides navbar, collapses cards to a clean table-only view — use browser Print → Save as PDF for a zero-dependency PDF

#### PDF download (server-side, no browser needed)
- [ ] Install `pdfkit` — generates a PDF directly in Node without a headless browser
- [ ] Add `/api/watchlist/report/pdf` endpoint — fetches all watchlist positions, assembles the same metrics as the report page, streams a PDF response
- [ ] "Download PDF" button on the report page — triggers a `window.open('/api/watchlist/report/pdf')` download
- [ ] PDF layout: header with date + "vpfund Watchlist Report", summary row, full position table, flagged positions at the bottom

#### Email to yourself (optional, local only)
- [ ] Install `nodemailer`
- [ ] Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `REPORT_TO` to `.env.local` — works with Gmail app passwords (no OAuth needed for personal use)
- [ ] Add `/api/watchlist/report/email` endpoint — generates the PDF and attaches it to an email via nodemailer, sends to `REPORT_TO`
- [ ] "Email Report" button on the report page alongside "Download PDF"
- [ ] Can be scheduled via system cron for automatic weekly delivery: `0 8 * * 1 curl -X POST http://localhost:3000/api/watchlist/report/email`

### High-Signal News (Value Investor Filter)
General news headlines add noise, not signal. Two data sources are worth adding because they reflect structural changes to intrinsic value — both are free and require no API keys.

**SEC Form 4 — Insider Transactions (EDGAR)**
Form 4 filings are legally required within 2 business days of any insider buy or sell. More granular than the 6-month aggregate Finviz shows — lets you see individual transaction dates, prices, and sizes.
- [ ] Scrape `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=4&dateb=&owner=include&count=10&search_text=` per ticker
- [ ] Parse filer name, transaction date, shares bought/sold, price per share, and resulting ownership %
- [ ] Display as a transaction table on the stock detail page below the Insider Activity card
- [ ] Highlight cluster buying (multiple insiders buying within the same 30-day window) — strongest signal

**Earnings Surprise History (Finviz)**
A consistent EPS beat pattern raises confidence in forward earnings estimates; a deteriorating pattern is an early warning that consensus is too optimistic.
- [ ] Scrape last 4–8 quarters of EPS actual vs estimate from Finviz or SEC filings
- [ ] Show beat/miss/inline per quarter as a compact timeline on the stock detail page
- [ ] Flag if the last 2+ quarters were misses — downgrade EPS growth reliability in the buy signal

### Buy Signal Engine
Composite score computed at scrape time and cached — no extra API calls at display time.

**Already implemented:**
- [x] Graham Number margin of safety (PE × PB < 22.5 — core screener signal)
- [x] Buy signal badge on screener: Strong Buy · Buy · Neutral · No Data
- [x] SQLite signal cache with 6-hour TTL

**Remaining:**
- [ ] Add Debt/EBITDA < 2.0 and Debt/Revenue < 0.5 to signal scoring (data already scraped)
- [ ] Add dividend FCF coverage ≥ 1.2× and payout ratio ≤ 60% to signal scoring
- [ ] Add 52-week low proximity (within 20% of low = value entry bonus)
- [ ] Expose signal score breakdown on stock detail page (show which criteria passed/failed)
- [ ] Macro regime overlay — automatically note when Risk-Off regime reduces signal reliability

### Macro & Market Conditions
**Already implemented:**
- [x] `/macro` dashboard — market regime (Risk-On/Neutral/Risk-Off), VIX, 10Y/2Y yields, Fed Funds rate
- [x] Yield curve spread with inversion detection
- [x] IG and HY credit spreads (BAML OAS via FRED)
- [x] SPY performance and 200-day SMA trend
- [x] 11 SPDR sector ETFs — 1W/1M/YTD performance, vs MA200, rate sensitivity, climate risk
- [x] MacroBanner on every stock detail page — live regime context at a glance

**Remaining:**
- [ ] Macro regime overlay on buy signal — automatically downgrade scores during Risk-Off
- [ ] Fed policy direction indicator — parse recent FOMC statement sentiment (hawkish/neutral/dovish)
- [ ] Sector rotation signal — flag which sectors are accelerating vs decelerating relative to SPY

### Business Quality & Risk
**Already implemented:**
- [x] Moat Quality score — ROE, ROIC, Profit Margin scored 0–6 with Strong/Moderate/Narrow/Weak verdict
- [x] Insider Activity — ownership % and 6-month net transaction trend (Buying/Neutral/Selling)
- [x] Climate & Weather Risk — sector-based physical and transition risk (0–10 score)
- [x] Interest Rate Sensitivity — sector-based DCF duration risk (0–10 score)

**Remaining:**
- [ ] SEC Form 4 transaction detail (see High-Signal News above)
- [ ] Earnings surprise history (see High-Signal News above)
- [ ] Altman Z-Score — bankruptcy risk composite from balance sheet ratios (all inputs already scraped)

### Mobile Access (Home Intranet)
No cloud, no external services, no database migration. Runs entirely on your home network — phone and server on the same WiFi.

#### Step 1 — Run in production mode on an always-on machine
`pnpm dev` is for development. For daily use, build once and run the production server — faster, lower memory, no file watching overhead.

- [ ] Add `pnpm build && pnpm start` as the standard run command in README
- [ ] Run on any always-on machine: main desktop, old laptop, Raspberry Pi 4, or NAS with Node support
- [ ] SQLite database file persists in `/data/vpfund.db` — no changes needed

#### Step 2 — Access from phone on WiFi
- [ ] Find the machine's local IP (`ipconfig` on Windows, `ifconfig` or `ip addr` on Mac/Linux)
- [ ] Open `http://192.168.x.x:3000` on phone browser while on home WiFi
- [ ] Optionally assign a static local IP in your router's DHCP settings so the address never changes
- [ ] Optionally set a local hostname (`vpfund.local`) via the machine's Bonjour/mDNS so the URL is memorable

#### Step 3 — Install as PWA (home screen app)
Works over plain HTTP on a local network — no HTTPS required for local PWA install on most mobile browsers.
- [ ] Add `manifest.json` with app name, icon, and `"display": "standalone"`
- [ ] Add `next-pwa` for service worker — enables "Add to Home Screen" prompt and offline caching of last-viewed pages
- [ ] App opens full-screen from home screen, no browser chrome, behaves like native

#### Step 4 — Daily digest via ntfy (zero external infrastructure)
[ntfy](https://ntfy.sh) is a self-hosted push notification server — a single binary, no account, no cloud. Install it on the same machine as the app. The phone installs the free ntfy app and subscribes to your local server topic.

- [ ] Install ntfy on the home server (`brew install ntfy` / `apt install ntfy` / single binary download)
- [ ] Run ntfy on port 8080 alongside the app — one `ntfy serve` command, no config file needed
- [ ] Add `NTFY_URL=http://192.168.x.x:8080/vpfund-daily` to `.env.local`
- [ ] Add `/api/digest` endpoint: assembles daily summary (regime, VIX, yield curve, watchlist vs SPY, signal changes) and POSTs it to ntfy
- [ ] Schedule with system cron (`crontab -e`) — one line: `30 9 * * 1-5 curl -X POST http://localhost:3000/api/digest`
- [ ] Phone receives push notification at 9:30am ET on weekdays — tap to open the app directly

### Performance
- [ ] Pre-compute and cache buy scores at scrape time to keep screener load < 500ms
- [ ] Background refresh job (cron) to update scores for watchlist stocks overnight
- [ ] Batch Finviz requests for watchlist performance instead of N serial fetches

### Security & Dependency Hygiene
Automated checks that run on each `pnpm dev` startup and warn in-app when action is needed — no CI/CD required for a self-hosted tool.

**Dependency updates:**
- [ ] On startup, run `pnpm outdated --json` and surface a banner in the UI listing packages with available updates
- [ ] Classify updates by severity: **patch** (safe, auto-apply) · **minor** (review changelog) · **major** (breaking change warning with migration notes link)
- [ ] Store last-checked timestamp in SQLite so the check runs at most once per day, not on every hot reload
- [ ] Deep-link each flagged package to its changelog on npm or GitHub

**Security scanning:**
- [ ] On startup, run `pnpm audit --json` and parse results into low / moderate / high / critical buckets
- [ ] Display a persistent warning banner in the navbar when high or critical CVEs are present
- [ ] Store audit results in SQLite cache (refresh daily) so the audit doesn't block app startup
- [ ] Link directly to the advisory URL for each vulnerability so it can be assessed and patched quickly

**Breaking change detection:**
- [ ] When a major version update is detected, fetch and display the package's GitHub release notes or CHANGELOG.md automatically
- [ ] Flag Next.js, React, and better-sqlite3 major updates with an explicit "breaking change likely" badge — these have the highest impact on the app
- [ ] Warn if Node.js version in `.nvmrc` is no longer in LTS support window

**Implementation approach:**
- [ ] `/api/system/health` endpoint — runs `pnpm outdated` + `pnpm audit` server-side, caches in SQLite, returns structured JSON
- [ ] `SystemBanner` component in `NavBar` — polls `/api/system/health` on mount, renders a dismissible warning strip when issues are found
- [ ] Severity color coding: yellow (outdated minor) · orange (outdated major) · red (security CVE)

---

<div align="center">

**vpfund** · Built for value investors · For informational purposes only

</div>
