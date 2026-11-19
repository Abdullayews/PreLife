import { NextResponse, type NextRequest } from "next/server";
import { scheduleWindow } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/psych/schedule-window — taken slots (mine + everyone's) for
 * the next 14 days. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await scheduleWindow(cs.user));
  } catch (e) {
    return toErrorResponse(e);
  }
}
