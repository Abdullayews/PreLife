import { NextResponse, type NextRequest } from "next/server";
import {
  authAdminDeleteUser,
  authPkceExchange,
  supabaseConfigured,
  userFromAuth,
} from "@/lib/server/supa";
import {
  clearedOAuthCookie,
  createSession,
  isSecure,
  OAUTH_COOKIE,
  originFrom,
  sessionCookie,
} from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** How fresh a GoTrue row must be to count as "created by this OAuth
 * dance" (clock skew included). */
const OAUTH_NEW_WINDOW_MS = 5 * 60 * 1000;

/** Read the locale + verifier packed by the oauth start route
 * ("<locale>.<verifier>"; bare verifiers from mid-flow upgrades parse
 * too and default to az). */
function parseOauthCookie(raw: string | undefined): { locale: string; verifier: string | null } {
  if (!raw) return { locale: "az", verifier: null };
  const m = raw.match(/^([a-z]{2})\.(.+)$/);
  if (!m) return { locale: "az", verifier: raw };
  const locale = m[1] === "en" || m[1] === "ru" ? m[1] : "az";
  return { locale, verifier: m[2] };
}

/**
 * GET /api/auth/callback?code=… — Supabase sends the visitor back here
 * after the provider dance. Exchanges the code with the PKCE verifier,
 * mints the pl_session cookie, clears the OAuth cookie and lands the
 * user on /home. Any failure goes to /login?error=oauth.
 *
 * v4.3: OAuth NEVER creates a PreLife account. Supabase auto-creates
 * the auth user during the provider dance, so a brand-new row (created
 * moments ago AND with no "email" provider — an existing e-mail account
 * linked by Google keeps its original creation time) is deleted again
 * and the visitor is bounced to the signup page with their e-mail
 * prefilled. They register properly; the next Google login links to the
 * confirmed account and just works.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) {
    return fail(req);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail(req);
  if (req.nextUrl.searchParams.get("error")) return fail(req);
  const { locale, verifier } = parseOauthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  if (!verifier) return fail(req);

  try {
    const exchanged = await authPkceExchange(code, verifier);
    const raw = exchanged.user as Record<string, unknown>;
    const user = userFromAuth(raw);
    if (!user) return fail(req);

    const origin = originFrom(req.headers);

    // Brand-new OAuth-only account? Cancel it — registrations go through
    // the e-mail verification flow, not the provider button.
    const appMeta = (raw.app_metadata ?? {}) as Record<string, unknown>;
    const providers = Array.isArray(appMeta.providers)
      ? appMeta.providers.map(String)
      : [];
    const createdAt = typeof raw.created_at === "string" ? Date.parse(raw.created_at) : NaN;
    const fresh =
      Number.isFinite(createdAt) && Date.now() - createdAt < OAUTH_NEW_WINDOW_MS;
    if (fresh && !providers.includes("email")) {
      await authAdminDeleteUser(user.id).catch(() => {});
      const res = NextResponse.redirect(
        `${origin}/${locale}/signup`
        + `?email=${encodeURIComponent(user.email)}`
        + `&notice=oauth_new`,
        302,
      );
      res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
      return res;
    }

    const session = await createSession(user, req.headers.get("user-agent"));
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
