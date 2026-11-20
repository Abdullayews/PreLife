import { NextResponse, type NextRequest } from "next/server";
import { assistantReply, parseChatBody } from "@/lib/server/ai";
import { currentSession } from "@/lib/server/session";
import { clientIp, rateAllow } from "@/lib/server/rate-limit";
import { jsonError, readJson, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/chat (public) — the site assistant. Guests get the plain
 * chat; signed-in users get the context-aware assistant with ACCOUNT
 * TOOLS (profile updates, preferences, workout plan, custom package) —
 * see lib/server/ai.ts for the Gemini → z-ai provider chain.
 *
 * No canned replies, ever: when both providers fail the chain throws
 * ApiCode(503, "ai_unavailable") and this route forwards it verbatim —
 * the client shows an honest retry instead of a fake answer.
 *
 * v4.7: rate limits — 10/min per IP for guests, 30/min per account
 * signed in. Every message is a paid provider call; the endpoint used
 * to be an open-ended cost tap.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  let parsed;
  try {
    parsed = parseChatBody(body);
  } catch {
    return jsonError(400, "invalid");
  }
  const page = typeof body.page === "string" ? body.page.slice(0, 120) : null;

  let user = null;
  try {
    const cs = await currentSession(req);
    if (cs) user = { id: cs.user.id, email: cs.user.email, name: cs.user.name };
  } catch {
    /* guest — plain assistant */
  }

  // v4.7: the cost ceiling — guests by IP (10/min), accounts by id
  // (30/min). The client surfaces a retry hint on 429.
  const allowed = user
    ? rateAllow(`ai:u:${user.id}`, 30, 60 * 1000)
    : rateAllow(`ai:ip:${clientIp(req.headers)}`, 10, 60 * 1000);
  if (!allowed) return jsonError(429, "rate_limited");

  try {
    const out = await assistantReply({
      locale: parsed.locale,
      history: parsed.history,
      page,
      user,
    });
    return NextResponse.json(out);
  } catch (e) {
    // ApiCode (503 ai_unavailable, 400 …) keeps its status + code;
    // anything unexpected logs and answers 500 generic. No invented text.
    return toErrorResponse(e);
  }
}
