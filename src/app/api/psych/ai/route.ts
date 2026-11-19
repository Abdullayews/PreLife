import { NextResponse, type NextRequest } from "next/server";
import { FALLBACK_PSY, chatReply, parseChatBody, SYSTEM_PSY } from "@/lib/server/ai";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/psych/ai (auth) — the in-app psychology companion. */
export async function POST(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    if (!cs) return jsonError(401, "unauthorized");
    const body = await readJson(req);
    let parsed;
    try {
      parsed = parseChatBody(body);
    } catch {
      return jsonError(400, "invalid");
    }
    const out = await chatReply(SYSTEM_PSY, FALLBACK_PSY, parsed.locale, parsed.history);
    return NextResponse.json(out);
  } catch (e) {
    return toErrorResponse(e);
  }
}
