import { NextResponse, type NextRequest } from "next/server";
import { cancel } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/psych/cancel { id } — cancel one of the user's appointments. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    return NextResponse.json(await cancel(cs.user, body));
  } catch (e) {
    return toErrorResponse(e);
  }
}
