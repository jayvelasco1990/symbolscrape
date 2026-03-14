<div align="center">

# vpfund

**A value investing toolkit for screening dividend-paying stocks, calculating intrinsic value, and analyzing leverage — all in one place.**

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

| Intrinsic Value | Debt Metrics |
|:---:|:---:|
| ![Intrinsic Value](docs/screenshots/intrinsic-value.png) | ![Debt Metrics](docs/screenshots/debt-metrics.png) |

![Stock Detail](docs/screenshots/stock-detail.png)

---

## What is vpfund?

vpfund is a self-hosted stock research tool built for value investors. It screens dividend-paying stocks across market cap tiers, calculates the **Graham Number** (intrinsic value), and surfaces **Debt/Revenue** and **Debt/EBITDA** ratios with color-coded risk levels — all scraped in real time from Finviz and Reuters.

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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Table | TanStack Table v8 |
| Scraping | Cheerio (server-side) |
| Data Sources | Finviz, Reuters |
| Package Manager | pnpm |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

```bash
npm install -g pnpm
```

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/vpfund.git
cd vpfund

# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

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
│   ├── api/
│   │   └── stocks/
│   │       ├── route.ts                 # Finviz screener endpoint
│   │       └── [ticker]/
│   │           └── quote/
│   │               └── route.ts         # Quote + intrinsic value + debt metrics endpoint
│   └── components/
│       ├── NavBar.tsx                   # Sticky nav with symbol search
│       ├── SymbolSearch.tsx             # Ticker lookup input
│       ├── StocksTable.tsx              # Sortable, paginated screener table
│       ├── StockDetail.tsx              # Stock detail orchestrator
│       ├── IntrinsicValue.tsx           # Graham Number card with progress bar
│       └── DebtMetrics.tsx              # Debt/Revenue + Debt/EBITDA cards
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

## Roadmap

- [ ] Financial charts (revenue, earnings, cash flow over time)
- [ ] DCF calculator
- [ ] Watchlist / saved tickers
- [ ] Export to CSV

---

<div align="center">

**vpfund** · Built for value investors · For informational purposes only

</div>
