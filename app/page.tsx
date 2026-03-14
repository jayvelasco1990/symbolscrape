import Link from "next/link";

const FEATURES = [
  {
    icon: "◈",
    title: "Multi-Cap Screening",
    body: "Filter across Mega, Large, and Small cap stocks. Every result pays a dividend and meets strict beta and RSI thresholds.",
  },
  {
    icon: "⬡",
    title: "Graham Number",
    body: "Each stock detail page calculates the Graham Number — a conservative fair value estimate rooted in earnings and book value.",
  },
  {
    icon: "◎",
    title: "Debt Analysis",
    body: "Instantly see Debt/Revenue and Debt/EBITDA with color-coded risk levels so you can assess leverage at a glance.",
  },
  {
    icon: "◐",
    title: "Margin of Safety",
    body: "Compare current price to intrinsic value and see the margin of safety — the cushion between price and fair value.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Browse the screener", body: "Pick a market cap tier and scan dividend-paying stocks filtered by beta and RSI." },
  { step: "02", title: "Open a stock", body: "Click any ticker to pull financials, intrinsic value, and debt metrics in seconds." },
  { step: "03", title: "Assess the value", body: "Use the Graham Number and margin of safety to decide if the price makes sense." },
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
            vpfund screens dividend-paying stocks by beta, RSI, and market cap — then calculates intrinsic value and debt metrics for every ticker.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/screener"
              className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Open Screener →
            </Link>
            <Link
              href="/screener"
              className="px-8 py-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold transition-all border border-zinc-200 dark:border-zinc-700"
            >
              View Mega Caps
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-zinc-50 dark:bg-zinc-950 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase text-center mb-3">Features</p>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 text-center mb-12">
            Everything you need to screen with conviction
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
            Three steps to a better pick
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
            Start with the screener and click any ticker to see its Graham Number, margin of safety, and debt metrics.
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
