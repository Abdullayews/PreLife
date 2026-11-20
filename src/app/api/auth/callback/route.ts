import { NextResponse, type NextRequest } from "next/server";
import { authPkceExchange, supabaseConfigured, userFromAuth } from "@/lib/server/supa";
import {
  clearedOAuthCookie,
  createSession,
  isSecure,
  OAUTH_COOKIE,
  originFrom,
  sessionCookie,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/callback?code=… — Supabase sends the visitor back here
 * after the provider dance. Exchanges the code with the PKCE verifier,
 * mints the pl_session cookie, clears the OAuth cookie and lands the
 * user on /home. Any failure goes to /login?error=oauth.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) {
    return fail(req);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail(req);
  if (req.nextUrl.searchParams.get("error")) return fail(req);
  const verifier = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!verifier) return fail(req);

  try {
    const exchanged = await authPkceExchange(code, verifier);
    const user = userFromAuth(exchanged.user as Record<string, unknown>);
    if (!user) return fail(req);

    const session = await createSession(user, req.headers.get("user-agent"));
    const origin = originFrom(req.headers);
    const res = NextResponse.redirect(`${origin}/home`, 302);
    res.cookies.set(sessionCookie(session.token, isSecure(req.headers)));
    res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
    return res;
  } catch (e) {
    console.error("[auth:callback]", e);
    return fail(req);
  }
}

function fail(req: NextRequest): NextResponse {
  const origin = originFrom(req.headers);
  const res = NextResponse.redirect(`${origin}/login?error=oauth`, 302);
  res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
  return res;
}
