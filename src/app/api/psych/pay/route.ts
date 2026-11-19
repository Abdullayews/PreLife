import { NextResponse, type NextRequest } from "next/server";
import { pay } from "@/lib/server/psych-data";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/psych/pay { id } — mark an appointment as paid. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    return NextResponse.json(await pay(cs.user, body));
  } catch (e) {
    return toErrorResponse(e);
  }
}
