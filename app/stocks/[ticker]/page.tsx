import Link from "next/link";
import StockDetail from "@/app/components/StockDetail";

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function StockPage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 max-w-4xl mx-auto">
      <Link
        href="/"
        className="text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 inline-block transition-colors"
      >
        ← Back to screener
      </Link>

      <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">{symbol}</h1>

      <StockDetail ticker={ticker} />
    </div>
  );
}
