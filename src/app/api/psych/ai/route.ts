import { NextResponse, type NextRequest } from "next/server";
import { parseChatBody, psychReply } from "@/lib/server/ai";
import { currentSession } from "@/lib/server/session";
import { guardConfigured, jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/psych/ai (auth) — the in-app psychology companion
 *  (Gemini → z-ai, no account tools by design). No canned replies:
 *  when both providers fail, psychReply throws ApiCode(503,
 *  "ai_unavailable") and toErrorResponse forwards it verbatim. */
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
    const out = await psychReply(parsed.history);
    return NextResponse.json(out);
  } catch (e) {
    return toErrorResponse(e);
  }
}
