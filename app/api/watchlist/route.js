import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const items = db.prepare("SELECT * FROM watchlist ORDER BY added_at DESC").all();
  return NextResponse.json(items);
}

export async function POST(req) {
  const { ticker, price } = await req.json();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO watchlist (ticker, price) VALUES (?, ?)").run(
    ticker.toUpperCase(),
    price || null
  );
  return NextResponse.json({ ticker: ticker.toUpperCase() });
}

const VALID_STATUSES = new Set(["intact", "watch", "broken"]);

export async function PATCH(req) {
  const { ticker, quantity, unit_cost, thesis, thesis_status, alpha_target_up, alpha_target_down, time_horizon, macro_driver } = await req.json();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const db = getDb();
  if (quantity !== undefined) {
    db.prepare("UPDATE watchlist SET quantity = ? WHERE ticker = ?").run(
      Math.max(0, parseInt(quantity) || 0),
      ticker.toUpperCase()
    );
  }
  if (unit_cost !== undefined) {
    db.prepare("UPDATE watchlist SET unit_cost = ? WHERE ticker = ?").run(
      unit_cost === null ? null : Math.max(0, parseFloat(unit_cost) || 0),
      ticker.toUpperCase()
    );
  }
  if (thesis !== undefined) {
    db.prepare("UPDATE watchlist SET thesis = ? WHERE ticker = ?").run(
      thesis || null,
      ticker.toUpperCase()
    );
  }
  if (thesis_status !== undefined && VALID_STATUSES.has(thesis_status)) {
    db.prepare("UPDATE watchlist SET thesis_status = ? WHERE ticker = ?").run(
      thesis_status,
      ticker.toUpperCase()
    );
  }
  if (alpha_target_up !== undefined) {
    db.prepare("UPDATE watchlist SET alpha_target_up = ? WHERE ticker = ?").run(
      alpha_target_up === null ? null : parseFloat(alpha_target_up) || null,
      ticker.toUpperCase()
    );
  }
  const VALID_HORIZONS = new Set(["short", "medium", "long", "core"]);
  if (time_horizon !== undefined && VALID_HORIZONS.has(time_horizon)) {
    db.prepare("UPDATE watchlist SET time_horizon = ? WHERE ticker = ?").run(time_horizon, ticker.toUpperCase());
  }
  if (alpha_target_down !== undefined) {
    db.prepare("UPDATE watchlist SET alpha_target_down = ? WHERE ticker = ?").run(
      alpha_target_down === null ? null : parseFloat(alpha_target_down) || null,
      ticker.toUpperCase()
    );
  }
  const VALID_DRIVERS = new Set(["none","oil_falling","oil_rising","airlines","consumer","industrials","tech","biotech","energy_sec"]);
  if (macro_driver !== undefined && (macro_driver === null || VALID_DRIVERS.has(macro_driver))) {
    db.prepare("UPDATE watchlist SET macro_driver = ? WHERE ticker = ?").run(
      macro_driver || null,
      ticker.toUpperCase()
    );
  }
  return NextResponse.json({ ticker: ticker.toUpperCase() });
}

export async function DELETE(req) {
  const { ticker } = await req.json();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM watchlist WHERE ticker = ?").run(ticker.toUpperCase());
  return NextResponse.json({ ticker: ticker.toUpperCase() });
}
