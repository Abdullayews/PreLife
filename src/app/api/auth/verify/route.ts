import { NextResponse, type NextRequest } from "next/server";
import { authAdminGetUser, authAdminUpdateUser, supaSelectOne, supabaseConfigured } from "@/lib/server/supa";
import { createSession, isSecure, originFrom, sessionCookie } from "@/lib/server/session";
import { consumeVerification, normLocale, purgeRegistration } from "@/lib/server/verification";
import { jsonError } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/auth/verify?token&locale — the e-mail confirmation link.
 * Confirms the account, starts the session and bounces to the verify
 * page (?status=ok|expired|invalid, plus &complete=1 when the account
 * still needs its name + password). This is the account activation
 * path, so it works WITHOUT an existing session by design.
 *
 * v4.3: an expired link means the 1-week window lapsed — the pending
 * registration is cancelled here (purged) and the page tells the
 * visitor to sign up again. */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");

  const sp = req.nextUrl.searchParams;
  const token = sp.get("token") ?? "";
  const locale = normLocale(sp.get("locale"));
  const origin = originFrom(req.headers);
  const bounce = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  if (!token) return bounce(`/${locale}/verify?status=invalid`);

  let result;
  try {
    result = await consumeVerification(token);
  } catch (e) {
    console.error("[auth:verify]", e);
    return bounce(`/${locale}/verify?status=invalid`);
  }

  if (typeof result === "string") return bounce(`/${locale}/verify?status=invalid`);
  if (result.status === "expired") {
    // The 1-week window lapsed — cancel the registration, then tell the
    // visitor to start over (the signup form gets the e-mail prefilled).
    await purgeRegistration(result.userId);
    return bounce(
      `/${locale}/verify?status=expired&email=${encodeURIComponent(result.email)}`,
    );
  }

  const { userId, email } = result;
  try {
    await authAdminUpdateUser(userId, { email_confirm: true });
  } catch (e) {
    console.error("[auth:verify confirm]", e);
    return bounce(`/${locale}/verify?status=invalid`);
  }

  // v4.3: accounts started from the login page ("e-mail only") hold a
  // random password — they must complete the name + password step.
  let needsCompletion = false;
  try {
    const full = await authAdminGetUser(userId);
    const meta = full.user_metadata as Record<string, unknown> | undefined;
    needsCompletion = meta?.needs_completion === true;
  } catch {
    /* treat as complete — the profile flow still works */
  }

  let name: string | null = null;
  try {
    const prof = await supaSelectOne("profiles", [
      ["select", "full_name"],
      ["id", `eq.${userId}`],
    ]);
    name = prof && typeof prof.full_name === "string" ? prof.full_name : null;
  } catch {
    /* the session row carries a null name — fine */
  }

  try {
    const session = await createSession(
      { id: userId, email, name },
      req.headers.get("user-agent"),
    );
    const res = bounce(
      `/${locale}/verify?status=ok${needsCompletion ? "&complete=1" : ""}`,
    );
    res.cookies.set(sessionCookie(session.token, isSecure(req.headers)));
    return res;
  } catch (e) {
    console.error("[auth:verify session]", e);
    return bounce(`/${locale}/verify?status=invalid`);
  }
}
