import StocksTable from "./components/StocksTable";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black px-6 py-10 w-full max-w-full">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
        Stock Screener
      </h1>
      <StocksTable />
    </div>
  );
}
