import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** POST /api/psychology/cancel — { id }: the caller cancels their own
 *  upcoming appointment (status → cancelled, slot frees up). */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (typeof body.id !== "string" || body.id.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const row = await db.appointment.findUnique({ where: { id: body.id } });
    if (!row || row.userId !== current.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (row.startAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "already_started" }, { status: 409 });
    }
    await db.appointment.update({ where: { id: row.id }, data: { status: "cancelled" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[psychology:cancel]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
