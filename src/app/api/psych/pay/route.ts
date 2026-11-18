import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** POST /api/psych/pay — { id }: mark the caller's appointment as
 *  paid. Real payments arrive with the subscription phase; for now the
 *  flag is a status the user manages ("ödənişi etdim" style demo). */
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
    await db.appointment.update({ where: { id: row.id }, data: { payment: "paid" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[psychology:pay]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
