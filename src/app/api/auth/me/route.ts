import { NextResponse, type NextRequest } from "next/server";
import { currentSession, userView } from "@/lib/server/session";
import { guardConfigured, toErrorResponse } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — the session user from the cookie, or null. */
export async function GET(req: NextRequest) {
  const blocked = guardConfigured();
  if (blocked) return blocked;
  try {
    const cs = await currentSession(req);
    return NextResponse.json({ user: cs ? userView(cs.user) : null });
  } catch (e) {
    return toErrorResponse(e);
  }
}
