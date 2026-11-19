import { NextResponse, type NextRequest } from "next/server";
import { authAdminCreateUser, supabaseConfigured, userFromAuth } from "@/lib/server/supa";
import { originFrom } from "@/lib/server/session";
import { createVerification } from "@/lib/server/verification";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/auth/signup { name, email, password, locale } — the account
 * is created UNCONFIRMED (Supabase Auth; the handle_new_user trigger
 * makes the profiles row) and a 24h verification e-mail goes out. No
 * session is minted here: the account activates only when the link is
 * opened (/api/auth/verify). */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const locale = typeof body.locale === "string" ? body.locale : "az";

  if (!name || !email || !password) return jsonError(400, "missing_fields");
  // /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const parts = email.split("@");
  const emailOk = parts.length === 2
    && parts[0].length > 0 && parts[1].length > 0
    && !/\s/.test(parts[0]) && !/\s/.test(parts[1])
    && parts[1].includes(".")
    && parts[1].split(".").every((seg) => seg.length > 0);
  if (!emailOk) return jsonError(400, "invalid_email");
  if ([...password].length < 8) return jsonError(400, "short_password");

  let created: Record<string, unknown>;
  try {
    created = await authAdminCreateUser(email, password, name, false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("422")) return jsonError(409, "email_taken");
    if (msg.includes("gotrue 400")) return jsonError(400, "invalid_email");
    console.error("[auth:signup]", msg);
    return jsonError(500, "generic");
  }
  const user = userFromAuth(created);
  if (!user) return jsonError(500, "generic");

  try {
    const { devLink } = await createVerification(
      user.id, email, locale, originFrom(req.headers),
    );
    return NextResponse.json({ ok: true, email, devLink }, { status: 201 });
  } catch (e) {
    console.error("[auth:signup verification]", e);
    return jsonError(500, "generic");
  }
}
