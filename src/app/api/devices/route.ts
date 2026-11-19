import { NextResponse, type NextRequest } from "next/server";
import { devicesList } from "@/lib/server/account";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/devices — the signed-in user's active sessions (Devices screen). */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await devicesList(cs));
  } catch (e) {
    return toErrorResponse(e);
  }
}
