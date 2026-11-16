import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { bakuParts } from "@/lib/psychology";

const inRange = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

/** GET /api/psychology/mood — the caller's last 60 daily check-ins
 *  (oldest last), for charts and the streak. */
export async function GET() {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await db.moodLog.findMany({
    where: { userId: current.user.id },
    orderBy: { date: "asc" },
    take: 60,
  });
  return NextResponse.json({ logs: rows });
}

/** POST /api/psychology/mood — upsert today's check-in (Baku calendar
 *  day). Body: { mood, energy, sleepQ: 1–5, tags?: string[] (MOOD_TAGS
 *  subset), note?: string (≤ 280 chars) }. */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    mood?: unknown; energy?: unknown; sleepQ?: unknown; tags?: unknown; note?: unknown;
  };
  if (!inRange(body.mood) || !inRange(body.energy) || !inRange(body.sleepQ)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const mood = body.mood as number;
  const energy = body.energy as number;
  const sleepQ = body.sleepQ as number;
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.filter((t): t is string => typeof t === "string" && t.length <= 24))].slice(0, 5).join(",")
    : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : "";
  const date = bakuParts(new Date()).date;

  try {
    const row = await db.moodLog.upsert({
      where: { userId_date: { userId: current.user.id, date } },
      create: { userId: current.user.id, date, mood, energy, sleepQ, tags, note: note || null },
      update: { mood, energy, sleepQ, tags, note: note || null },
    });
    return NextResponse.json({ ok: true, date: row.date });
  } catch (err) {
    console.error("[psychology:mood]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
