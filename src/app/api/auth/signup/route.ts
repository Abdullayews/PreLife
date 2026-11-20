import { NextResponse, type NextRequest } from "next/server";
import {
  authAdminCreateUser,
  authAdminFindUserByEmail,
  authAdminUpdateUser,
  isConfirmedUser,
  supaUpdate,
  supabaseConfigured,
  userFromAuth,
} from "@/lib/server/supa";
import { originFrom } from "@/lib/server/session";
import {
  createVerification,
  pendingVerificationForUser,
  purgeRegistration,
  verificationExpired,
} from "@/lib/server/verification";
import { jsonError, readJson } from "@/lib/server/route-helpers";

export const dynamic = "force-dynamic";

/** POST /api/auth/signup { name, email, password, locale } — the account
 * is created UNCONFIRMED (Supabase Auth; the handle_new_user trigger
 * makes the profiles row) and a 1-week verification e-mail goes out. No
 * session is minted here: the account activates only when the link is
 * opened (/api/auth/verify); unconfirmed registrations are cancelled
 * after the window lapses.
 *
 * v4.3: when the e-mail already holds a PENDING registration (typical
 * after the login-page "e-mail only" start), it is adopted — the name
 * and password are written onto the pending user instead of failing
 * with "e-mail taken". Only confirmed accounts conflict (409). */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const locale = typeof body.locale === "string" ? body.locale : "az";

  if (!name || !email || !password) return jsonError(400, "missing_fields");
  if ([...name].length < 2) return jsonError(400, "missing_fields");
  const parts = email.split("@");
  const emailOk = parts.length === 2
    && parts[0].length > 0 && parts[1].length > 0
    && !/\s/.test(parts[0]) && !/\s/.test(parts[1])
    && parts[1].includes(".")
    && parts[1].split(".").every((seg) => seg.length > 0);
  if (!emailOk) return jsonError(400, "invalid_email");
  if ([...password].length < 8) return jsonError(400, "short_password");

  const lang = locale === "en" ? "en" : locale === "ru" ? "ru" : "az";
  const origin = originFrom(req.headers);

  // ── Fresh create ───────────────────────────────────────────────────────
  let created: Record<string, unknown>;
  try {
    created = await authAdminCreateUser(email, password, name, false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("422")) {
      // E-mail taken — by a pending registration or a real account?
      let existing: Record<string, unknown> | null = null;
      try {
        existing = await authAdminFindUserByEmail(email);
      } catch {
        return jsonError(409, "email_taken");
      }
      if (!existing || typeof existing.id !== "string") return jsonError(409, "email_taken");

      if (isConfirmedUser(existing)) return jsonError(409, "email_taken");

      const pending = await pendingVerificationForUser(existing.id);
      if (verificationExpired(pending)) {
        // The old registration lapsed — cancel it and start clean.
        await purgeRegistration(existing.id);
        try {
          created = await authAdminCreateUser(email, password, name, false);
        } catch (e2) {
          console.error("[auth:signup retry]", e2);
          return jsonError(500, "generic");
        }
      } else {
        // Adopt the pending user: their chosen name + password land on
        // the account the verification e-mail already points at.
        const id = existing.id;
        try {
          await authAdminUpdateUser(id, {
            password,
            user_metadata: { full_name: name, needs_completion: false },
          });
          await supaUpdate("profiles", [["id", `eq.${id}`]], {
            full_name: name, ...(lang !== "en" ? { lang } : {}),
          }).catch(() => {});
        } catch (e2) {
          console.error("[auth:signup adopt]", e2);
          return jsonError(500, "generic");
        }
        try {
          const { devLink } = await createVerification(id, email, locale, origin);
          return NextResponse.json({ ok: true, email, devLink }, { status: 201 });
        } catch (e2) {
          console.error("[auth:signup verification]", e2);
          return jsonError(500, "generic");
        }
      }
    } else if (msg.includes("gotrue 400")) {
      return jsonError(400, "invalid_email");
    } else {
      console.error("[auth:signup]", msg);
      return jsonError(500, "generic");
    }
  }

  const user = userFromAuth(created);
  if (!user) return jsonError(500, "generic");

  // The profile starts in the visitor's language (the handle_new_user
  // trigger defaults to 'en') — so the first signed-in visit does not
  // fight the locale the user signed up in.
  if (lang !== "en") {
    await supaUpdate("profiles", [["id", `eq.${user.id}`]], { lang }).catch(() => {});
  }

  try {
    const { devLink } = await createVerification(user.id, email, locale, origin);
    return NextResponse.json({ ok: true, email, devLink }, { status: 201 });
  } catch (e) {
    console.error("[auth:signup verification]", e);
    return jsonError(500, "generic");
  }
}
