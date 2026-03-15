import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../docs/screenshots");
const BASE = "http://localhost:3000";
const W = 1440;

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

async function shot(name, url, { waitFor, scrollY, clip } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 30000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => {});
  if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await new Promise(r => setTimeout(r, 800));
  const opts = { path: `${OUT}/${name}.png` };
  if (clip) opts.clip = clip;
  await page.screenshot(opts);
  console.log(`✓ ${name}`);
  await page.close();
}

// Landing
await shot("landing", "/");

// Screener
await shot("screener", "/screener?tab=megacap", { waitFor: "table" });

// Stock detail — use AAPL, wait for data to load
await shot("stock-detail", "/stocks/AAPL?price=200", {
  waitFor: ".text-4xl",
  scrollY: 0,
});

// Intrinsic value section of stock detail (scrolled down)
await shot("intrinsic-value", "/stocks/AAPL?price=200", {
  waitFor: ".text-4xl",
  scrollY: 300,
  clip: { x: 0, y: 250, width: W * 2, height: 700 },
});

// Debt metrics section
await shot("debt-metrics", "/stocks/AAPL?price=200", {
  waitFor: ".text-4xl",
  scrollY: 700,
  clip: { x: 0, y: 650, width: W * 2, height: 600 },
});

// Watchlist page
await shot("watchlist", "/watchlist", { waitFor: "table, .text-zinc-400" });

// Performance breakdown
await shot("performance-breakdown", "/watchlist/performance", {
  waitFor: "table, .text-zinc-400",
});

await browser.close();
console.log("\nAll screenshots saved to docs/screenshots/");
