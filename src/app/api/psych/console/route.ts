import { NextResponse, type NextRequest } from "next/server";
import { consoleList, consoleRespond } from "@/lib/server/psych-data";
import { currentSession, originFrom } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/psych/console — the linked psychologist's request queues
 *  (pending / confirmed / upcoming), each with the client's name + e-mail. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    return NextResponse.json(await consoleList(cs.user));
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST /api/psych/console { id, action: "confirm" | "decline" } — answer a
 *  pending request. Confirming mails the client that payment is due. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    return NextResponse.json(await consoleRespond(cs.user, body, originFrom(req.headers)));
  } catch (e) {
    return toErrorResponse(e);
  }
}
