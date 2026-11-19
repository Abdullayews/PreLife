import { NextResponse, type NextRequest } from "next/server";
import { deviceRevoke, deviceUpdate } from "@/lib/server/account";
import { currentSession, DEVICE_ICON_CHOICES } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** PATCH /api/devices/{id} { name?, icon? } — rename/re-icon a device. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const { id } = await ctx.params;
    const body = await readJson(req);
    return NextResponse.json(await deviceUpdate(cs, id, body, DEVICE_ICON_CHOICES));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** DELETE /api/devices/{id} — revoke one session. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const { id } = await ctx.params;
    return NextResponse.json(await deviceRevoke(cs, id));
  } catch (e) {
    return toErrorResponse(e);
  }
}
