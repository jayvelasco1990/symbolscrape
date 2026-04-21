import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "vpfund.db");

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        content    TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS watchlist (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker     TEXT    NOT NULL UNIQUE,
        price      TEXT,
        quantity   INTEGER NOT NULL DEFAULT 0,
        added_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS perf_cache (
        ticker     TEXT    NOT NULL PRIMARY KEY,
        data       TEXT    NOT NULL,
        fetched_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS macro_cache (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        data       TEXT    NOT NULL,
        fetched_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS signal_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        signal     TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    // Migrate existing watchlist tables that predate the quantity column
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
    // Migrate to add unit cost (cost basis per share)
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN unit_cost REAL`); } catch (_) {}
    // Migrate to add thesis tracking
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN thesis TEXT`); } catch (_) {}
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN thesis_status TEXT NOT NULL DEFAULT 'intact'`); } catch (_) {}
    // Migrate to add alpha exit targets
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN alpha_target_up REAL`); } catch (_) {}
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN alpha_target_down REAL`); } catch (_) {}
    // Migrate to add time horizon per position
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN time_horizon TEXT NOT NULL DEFAULT 'medium'`); } catch (_) {}
    // Migrate to add macro thesis driver per position
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN macro_driver TEXT`); } catch (_) {}
    // Migrate to add trim cooldown tracking
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN last_trim_at TEXT`); } catch (_) {}
    try { db.exec(`ALTER TABLE watchlist ADD COLUMN last_trim_price REAL`); } catch (_) {}
    db.exec(`
      CREATE TABLE IF NOT EXISTS valuation_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        data       TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS rs_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        ytd        REAL,
        month      REAL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS thesis_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        data       TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS price_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        price      REAL,
        change_pct REAL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS revenue_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        data       TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sec_cache (
        ticker                  TEXT NOT NULL PRIMARY KEY,
        cik                     TEXT NOT NULL,
        capital_intensity       REAL,
        capital_intensity_label TEXT,
        earnings_consistency    TEXT,
        consistency_years       INTEGER,
        avg_roe                 REAL,
        avg_margin              REAL,
        fetched_at              TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS momentum_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        score      INTEGER NOT NULL,
        label      TEXT NOT NULL,
        rsi        REAL,
        sma50_pct  REAL,
        sma200_pct REAL,
        roc1m      REAL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS growth_cache (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        data       TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS projection_cache (
        ticker     TEXT NOT NULL PRIMARY KEY,
        eps5y      REAL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker       TEXT    NOT NULL,
        action       TEXT    NOT NULL DEFAULT 'sell',
        units        INTEGER NOT NULL,
        price        REAL    NOT NULL,
        unit_cost    REAL,
        proceeds     REAL    NOT NULL,
        gain_loss    REAL,
        holding_days INTEGER,
        term         TEXT,
        status       TEXT    NOT NULL DEFAULT 'pending',
        recorded_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    // Migrate existing trades that predate the status column
    try { db.exec(`ALTER TABLE trades ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'`); } catch (_) {}
  }
  return db;
}
