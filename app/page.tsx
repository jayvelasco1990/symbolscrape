import Link from "next/link";

const FEATURES = [
  {
    icon: "◈",
    title: "Multi-Cap Screening",
    body: "Filter across Mega, Large, and Small cap stocks with optional dividend and RSI filters. Sorted by P/E for instant value ranking.",
  },
  {
    icon: "⬡",
    title: "Graham Number",
    body: "Each stock detail page calculates the Graham Number — a conservative fair value estimate rooted in earnings and book value — with margin of safety shown live.",
  },
  {
    icon: "◎",
    title: "Debt & Dividend Analysis",
    body: "Debt/Revenue and Debt/EBITDA with color-coded risk levels. Dividend sustainability scored by payout ratio and FCF coverage.",
  },
  {
    icon: "◐",
    title: "Watchlist & Portfolio Tracking",
    body: "Save stocks, enter share quantities, and track total market value — all persisted locally in SQLite. No account required.",
  },
  {
    icon: "◑",
    title: "Performance vs SPY",
    body: "Compare your portfolio against the S&P 500 across six time periods. Value-weighted by position size, cached and refreshed daily.",
  },
  {
    icon: "◍",
    title: "Diversification Score",
    body: "HHI-based scoring tells you how concentrated your portfolio is, with an effective position count and step-by-step formula explanation.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Screen the market", body: "Pick a cap tier, toggle dividend and RSI filters, and scan pre-filtered value candidates sorted by P/E." },
  { step: "02", title: "Research a stock", body: "Click any ticker to see the Graham Number, margin of safety, debt ratios, dividend sustainability, and financials." },
  { step: "03", title: "Build your watchlist", body: "Add stocks with one click. Enter quantities to track position value, compare performance vs SPY, and measure diversification." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-32 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-4 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950">
            Value Investing Toolkit
          </span>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight mt-4">
            Find undervalued stocks.<br />
            <span className="text-indigo-600 dark:text-indigo-400">Before the market does.</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Screen dividend-paying stocks by beta, RSI, and market cap. Calculate intrinsic value, analyze debt and dividends, track a watchlist, and benchmark your portfolio against SPY.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/screener"
              className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Open Screener →
            </Link>
            <Link
              href="/watchlist"
              className="px-8 py-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold transition-all border border-zinc-200 dark:border-zinc-700"
            >
              View Watchlist
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-zinc-50 dark:bg-zinc-950 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase text-center mb-3">Features</p>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 text-center mb-12">
            Everything from screening to portfolio tracking
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white dark:bg-black rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <span className="text-2xl text-indigo-500 dark:text-indigo-400">{f.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase text-center mb-3">How It Works</p>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 text-center mb-12">
            From screener to watchlist in three steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="text-center">
                <span className="text-4xl font-black text-indigo-100 dark:text-indigo-900">{item.step}</span>
                <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-indigo-600 dark:bg-indigo-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to find value?</h2>
          <p className="text-indigo-200 text-sm mb-8 leading-relaxed">
            Screen stocks, research fundamentals, build a watchlist, and track how your portfolio stacks up against the S&P 500.
          </p>
          <Link
            href="/screener"
            className="inline-block px-8 py-3.5 rounded-xl bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50 transition-all shadow-lg"
          >
            Open Screener →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-zinc-200 dark:border-zinc-800 text-center">
        <p className="text-xs text-zinc-400">
          vpfund · Data sourced from Finviz & Reuters · For informational purposes only
        </p>
      </footer>

    </div>
  );
}
