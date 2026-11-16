import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  PSYCHOLOGISTS, bakuInstant, bakuParts, psyBySlug,
} from "@/lib/psychology";

/** POST /api/psychology/book — book a free slot with a psychologist.
 *  Body: { slug, date: "YYYY-MM-DD" (Baku wall-clock), hour: number,
 *  mode: "online" | "office" }. Validates the slot against the static
 *  weekly availability, today's clock, and existing bookings, then
 *  creates the Appointment row with the static session price. */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    slug?: unknown; date?: unknown; hour?: unknown; mode?: unknown;
  };
  const slug = typeof body.slug === "string" ? body.slug : "";
  const date = typeof body.date === "string" ? body.date : "";
  const hour = Number(body.hour);
  const mode = body.mode === "office" ? "office" : "online";
  const psy = psyBySlug(slug);

  if (!psy || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // The slot must fall into a weekly working block.
  const parts = bakuParts(bakuInstant(date, hour));
  const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  if (parts.date !== date) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const inBlock = psy.availability.some((b) => b.day === weekday && hour >= b.from && hour < b.to);
  if (!inBlock) {
    return NextResponse.json({ error: "slot_closed" }, { status: 409 });
  }

  const startAt = bakuInstant(date, hour);
  if (startAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "slot_past" }, { status: 409 });
  }

  try {
    const clash = await db.appointment.findFirst({
      where: {
        psychologistSlug: slug, startAt, status: { not: "cancelled" },
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }

    const own = await db.appointment.count({
      where: {
        userId: current.user.id, startAt, status: { not: "cancelled" },
      },
    });
    if (own > 0) {
      return NextResponse.json({ error: "double_booked" }, { status: 409 });
    }

    const row = await db.appointment.create({
      data: {
        userId: current.user.id, psychologistSlug: slug, startAt,
        mode, price: psy.price,
      },
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    console.error("[psychology:book]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}

/** Number of seeded psychologists — cheap sanity signal for the client. */
export async function GET() {
  return NextResponse.json({ count: PSYCHOLOGISTS.length });
}
