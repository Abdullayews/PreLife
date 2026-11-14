import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isDeviceIcon } from "@/lib/devices";

type Ctx = { params: Promise<{ id: string }> };

/** Loads a session row and verifies it belongs to the caller. */
async function ownSession(id: string) {
  const current = await getSession();
  if (!current) {
    return { status: 401 as const };
  }
  const target = await db.session.findUnique({ where: { id } });
  if (!target || target.userId !== current.user.id) {
    return { status: 404 as const };
  }
  return { current, target };
}

/** PATCH /api/devices/[id] — { name?, icon? }: rename the device and/or
 *  pick a different icon. Name: 1–40 chars after trimming. */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await ownSession(id);
  if ("status" in guard) return NextResponse.json({ error: "unauthorized_or_missing" }, { status: guard.status });

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; icon?: unknown };
  const data: { deviceName?: string; deviceIcon?: string } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 40) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }
    data.deviceName = name;
  }
  if (typeof body.icon === "string") {
    if (!isDeviceIcon(body.icon)) {
      return NextResponse.json({ error: "invalid_icon" }, { status: 400 });
    }
    data.deviceIcon = body.icon;
  }
  if (!data.deviceName && !data.deviceIcon) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  try {
    const row = await db.session.update({ where: { id }, data });
    return NextResponse.json({
      device: {
        id: row.id,
        name: row.deviceName,
        icon: row.deviceIcon,
        current: id === guard.current.session.id,
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
      },
    });
  } catch (err) {
    console.error("[devices:update]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}

/** DELETE /api/devices/[id] — sign that device out. Revoking the current
 *  device logs the caller out (the client then returns them to /welcome). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const guard = await ownSession(id);
  if ("status" in guard) return NextResponse.json({ error: "unauthorized_or_missing" }, { status: guard.status });

  try {
    await db.session.delete({ where: { id } });
    return NextResponse.json({ ok: true, current: id === guard.current.session.id });
  } catch (err) {
    console.error("[devices:revoke]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
