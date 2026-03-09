import Link from "next/link";

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function StockPage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 max-w-3xl mx-auto">
      <Link
        href="/"
        className="text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 inline-block transition-colors"
      >
        ← Back to screener
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
          {symbol}
        </h1>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-zinc-700 dark:text-zinc-300">
        <p className="text-sm">
          Summary for <span className="font-semibold">{symbol}</span> coming soon.
        </p>
      </div>
    </div>
  );
}
