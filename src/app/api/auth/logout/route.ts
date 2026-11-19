import { NextResponse, type NextRequest } from "next/server";
import {
  clearedSessionCookie,
  isSecure,
  revokeTokenSession,
  SESSION_COOKIE,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — revokes the session row and clears the cookie. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeTokenSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedSessionCookie(isSecure(req.headers)));
  return res;
}
