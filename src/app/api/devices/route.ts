import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** GET /api/devices — the signed-in user's active devices (Settings →
 *  Devices). Expired rows are pruned opportunistically; the device the
 *  request came from is flagged `current`. */
export async function GET() {
  const current = await getSession();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await db.session.deleteMany({
      where: { userId: current.user.id, expiresAt: { lt: new Date() } },
    });
    const rows = await db.session.findMany({
      where: { userId: current.user.id },
      orderBy: { lastUsedAt: "desc" },
    });
    return NextResponse.json({
      devices: rows.map((r) => ({
        id: r.id,
        name: r.deviceName,
        icon: r.deviceIcon,
        current: r.id === current.session.id,
        createdAt: r.createdAt,
        lastUsedAt: r.lastUsedAt,
      })),
    });
  } catch (err) {
    console.error("[devices:list]", err);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
