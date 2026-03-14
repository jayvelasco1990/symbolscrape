import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const messages = db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  return NextResponse.json(messages);
}

export async function POST(req) {
  const { content } = await req.json();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  const db = getDb();
  const result = db.prepare("INSERT INTO messages (content) VALUES (?)").run(content);
  return NextResponse.json({ id: result.lastInsertRowid, content });
}
