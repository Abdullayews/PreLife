import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/psych/journal/[id] — delete the caller's own entry. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const row = await db.journalEntry.findUnique({ where: { id } });
    if (!row || row.userId !== current.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await db.journalEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[psychology:journal:delete]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
