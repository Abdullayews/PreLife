import { NextResponse, type NextRequest } from "next/server";
import { authAdminUpdateUser, supaSelectOne, supabaseConfigured } from "@/lib/server/supa";
import { createSession, isSecure, originFrom, sessionCookie } from "@/lib/server/session";
import { consumeVerification, normLocale } from "@/lib/server/verification";
import { jsonError } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** GET /api/auth/verify?token&locale — the e-mail confirmation link.
 * Confirms the account, starts the session and bounces to the verify
 * page (?status=ok|expired|invalid). This is the account activation
 * path, so it works WITHOUT an existing session by design. */
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
    const sessionToken = await createSession(
      { id: userId, email, name },
      req.headers.get("user-agent"),
    );
    const res = bounce(`/${locale}/verify?status=ok`);
    res.cookies.set(sessionCookie(sessionToken, isSecure(req.headers)));
    return res;
  } catch (e) {
    console.error("[auth:verify session]", e);
    return bounce(`/${locale}/verify?status=invalid`);
  }
}
