export default function NavBar() {
  return (
    <nav className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-6 py-3 flex items-center gap-6">
      <a
        href="https://olui2.fs.ml.com/login/signin.aspx"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        Merrill Lynch
      </a>
    </nav>
  );
}
