import { NextResponse, type NextRequest } from "next/server";
import { moodList, moodUpsert } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/psych/mood — mood logs + recent quiz results. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await moodList(cs.user));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST /api/psych/mood { mood, energy, sleepQ, tags?, note? } — daily
 * check-in upsert (one row per Baku date). */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    return NextResponse.json(await moodUpsert(cs.user, body));
  } catch (e) {
    return toErrorResponse(e);
  }
}
