import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** GET /api/diet/journal — the caller's entries, newest first. */
export async function GET() {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db.journalEntry.findMany({
    where: { userId: current.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ entries: rows });
}

/** POST /api/diet/journal — { content, promptKey? }: create an
 *  entry. Content is required, 1–4000 chars. */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { content?: unknown; promptKey?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const promptKey = typeof body.promptKey === "string" && body.promptKey.length <= 80 ? body.promptKey : null;
  if (content.length === 0 || content.length > 4000) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const row = await db.journalEntry.create({
      data: { userId: current.user.id, content, promptKey },
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    console.error("[psychology:journal:create]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
