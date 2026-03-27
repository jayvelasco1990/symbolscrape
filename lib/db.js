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
  }
  return db;
}
