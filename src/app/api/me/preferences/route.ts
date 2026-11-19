import { NextResponse, type NextRequest } from "next/server";
import { preferencesGet, preferencesUpdate } from "@/lib/server/account";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/me/preferences — the signed-in user's saved language + theme. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await preferencesGet(cs.user));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** PATCH /api/me/preferences { locale?, theme? } — saves the UI choice on
 * the profile row so it follows the account across devices. */
export async function PATCH(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    return NextResponse.json(await preferencesUpdate(cs.user, body));
  } catch (e) {
    return toErrorResponse(e);
  }
}
