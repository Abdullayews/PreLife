import { NextResponse, type NextRequest } from "next/server";
import { FALLBACK_CHAT, chatReply, parseChatBody, SYSTEM_CHAT } from "@/lib/server/ai";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/ai/chat (public) — the site assistant with canned fallback. */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  let parsed;
  try {
    parsed = parseChatBody(body);
  } catch {
    return jsonError(400, "invalid");
  }
  const out = await chatReply(SYSTEM_CHAT, FALLBACK_CHAT, parsed.locale, parsed.history);
  return NextResponse.json(out);
}
