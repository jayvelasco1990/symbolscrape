import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const trades = db
    .prepare("SELECT * FROM trades ORDER BY recorded_at DESC")
    .all();
  return NextResponse.json(trades);
}

export async function POST(req: Request) {
  const { ticker, units, price, unit_cost, added_at } = await req.json();
  if (!ticker || !units || !price) {
    return NextResponse.json({ error: "ticker, units, price required" }, { status: 400 });
  }

  const proceeds  = units * price;
  const gain_loss = unit_cost != null ? proceeds - units * unit_cost : null;

  let holding_days: number | null = null;
  let term: string | null = null;
  if (added_at) {
    const bought = new Date(added_at + " UTC").getTime();
    holding_days = Math.floor((Date.now() - bought) / (1000 * 60 * 60 * 24));
    term = holding_days >= 365 ? "long" : "short";
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO trades (ticker, action, units, price, unit_cost, proceeds, gain_loss, holding_days, term, status)
       VALUES (?, 'sell', ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      ticker.toUpperCase(),
      Math.abs(units),
      price,
      unit_cost ?? null,
      proceeds,
      gain_loss,
      holding_days,
      term
    );

  // Stamp the cooldown watermark immediately so the trim won't resurface until
  // the cooldown expires AND price makes a new meaningful move above this level.
  db.prepare(
    `UPDATE watchlist SET last_trim_at = datetime('now'), last_trim_price = ? WHERE ticker = ?`
  ).run(price, ticker.toUpperCase());

  return NextResponse.json({ id: result.lastInsertRowid, status: "pending" });
}

export async function PATCH(req: Request) {
  const { id, price, status } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as {
    units: number; unit_cost: number | null; ticker: string; status: string;
  } | undefined;
  if (!trade) return NextResponse.json({ error: "trade not found" }, { status: 404 });

  // Confirm: just flip status
  if (status === "confirmed") {
    db.prepare("UPDATE trades SET status = 'confirmed' WHERE id = ?").run(id);
    return NextResponse.json({ id, status: "confirmed" });
  }

  // Price update: recalculate proceeds and gain_loss
  if (price != null) {
    const proceeds  = trade.units * price;
    const gain_loss = trade.unit_cost != null ? proceeds - trade.units * trade.unit_cost : null;
    db.prepare("UPDATE trades SET price = ?, proceeds = ?, gain_loss = ? WHERE id = ?").run(price, proceeds, gain_loss, id);
    return NextResponse.json({ id, price, proceeds, gain_loss });
  }

  return NextResponse.json({ error: "price or status required" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const { id, restore } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as {
    ticker: string; units: number;
  } | undefined;

  if (!trade) return NextResponse.json({ error: "trade not found" }, { status: 404 });

  // Reverse: restore the watchlist quantity and clear the cooldown watermark
  if (restore) {
    const row = db.prepare("SELECT quantity FROM watchlist WHERE ticker = ?").get(trade.ticker) as
      { quantity: number } | undefined;
    if (row != null) {
      const restoredQty = (row.quantity ?? 0) + trade.units;
      db.prepare(
        `UPDATE watchlist SET quantity = ?, last_trim_at = NULL, last_trim_price = NULL WHERE ticker = ?`
      ).run(restoredQty, trade.ticker);
    }
  }

  db.prepare("DELETE FROM trades WHERE id = ?").run(id);
  return NextResponse.json({ id, restored: !!restore });
}
