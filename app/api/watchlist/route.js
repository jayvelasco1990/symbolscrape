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

export async function PATCH(req) {
  const { ticker, quantity, unit_cost } = await req.json();
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
  return NextResponse.json({ ticker: ticker.toUpperCase() });
}

export async function DELETE(req) {
  const { ticker } = await req.json();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM watchlist WHERE ticker = ?").run(ticker.toUpperCase());
  return NextResponse.json({ ticker: ticker.toUpperCase() });
}
