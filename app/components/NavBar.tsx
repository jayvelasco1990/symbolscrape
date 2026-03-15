import Link from "next/link";
import SymbolSearch from "./SymbolSearch";
import ClearCacheButton from "./ClearCacheButton";

export default function NavBar() {
  return (
    <nav className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-black/90 backdrop-blur-sm px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
          vpfund
        </Link>
        <Link
          href="/screener"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Screener
        </Link>
        <Link
          href="/watchlist"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Watchlist
        </Link>
        <Link
          href="/macro"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Macro
        </Link>
        <a
          href="https://olui2.fs.ml.com/login/signin.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          Merrill Lynch ↗
        </a>
      </div>
      <div className="flex items-center gap-4">
        <ClearCacheButton />
        <SymbolSearch />
      </div>
    </nav>
  );
}
