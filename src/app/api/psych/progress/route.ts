import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { mediaById } from "@/lib/psychology";

/** POST /api/psych/progress — log meditation media progress.
 *  Body: { resourceId, seconds: 1–7200, completed?: boolean }. The
 *  resource must exist in the static catalog; unknown ids are rejected. */
export async function POST(req: Request) {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    resourceId?: unknown; seconds?: unknown; completed?: unknown;
  };
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  const seconds = Number(body.seconds);
  if (!mediaById(resourceId) || !Number.isFinite(seconds) || seconds < 1 || seconds > 7200) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    await db.meditationProgress.create({
      data: {
        userId: current.user.id, resourceId,
        kind: mediaById(resourceId)!.kind,
        seconds: Math.round(seconds),
        completed: body.completed === true,
      },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[psychology:progress]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
