import { NextResponse, type NextRequest } from "next/server";
import { assistantReply, parseChatBody } from "@/lib/server/ai";
import { currentSession } from "@/lib/server/session";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/chat (public) — the site assistant. Guests get the plain
 * chat; signed-in users get the context-aware assistant with ACCOUNT
 * TOOLS (profile updates, personal workout plan, custom package) — see
 * lib/server/ai.ts for the Gemini → z-ai → canned provider chain.
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

  const out = await assistantReply({
    locale: parsed.locale,
    history: parsed.history,
    page,
    user,
  });
  return NextResponse.json(out);
}
