import { NextResponse, type NextRequest } from "next/server";
import { authPasswordLogin, supabaseConfigured, userFromAuth } from "@/lib/server/supa";
import { createSession, isSecure, sessionCookie, userView } from "@/lib/server/session";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/auth/login { email, password } — credentials are verified
 * against the database (auth.users) by GoTrue's password grant. */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return jsonError(400, "missing_fields");

  let granted: Record<string, unknown>;
  try {
    granted = await authPasswordLogin(email, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Unconfirmed accounts fail the password grant with the same 400
    // invalid_grant shape as wrong credentials — the description tells
    // them apart. Checked first, before the generic invalid_grant match.
    if (msg.includes("Email not confirmed")) {
      return jsonError(403, "email_unverified");
    }
    if (msg.includes("invalid_grant") || msg.includes("Invalid login credentials")) {
      return jsonError(401, "invalid_credentials");
    }
    console.error("[auth:login]", msg);
    return jsonError(500, "generic");
  }
  const user = userFromAuth(granted.user as Record<string, unknown>);
  if (!user) return jsonError(500, "generic");

  try {
    const token = await createSession(user, req.headers.get("user-agent"));
    const res = NextResponse.json({ user: userView(user) });
    res.cookies.set(sessionCookie(token, isSecure(req.headers)));
    return res;
  } catch (e) {
    console.error("[auth:login session]", e);
    return jsonError(500, "generic");
  }
}
