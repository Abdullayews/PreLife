import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  authAdminCreateUser,
  authAdminFindUserByEmail,
  authPasswordLogin,
  isConfirmedUser,
  supaUpdate,
  supabaseConfigured,
  userFromAuth,
} from "@/lib/server/supa";
import { createSession, isSecure, originFrom, sessionCookie, userView } from "@/lib/server/session";
import { jsonError, readJson } from "@/lib/server/route-helpers";
import {
  createVerification,
  pendingVerificationForUser,
  purgeRegistration,
  verificationExpired,
} from "@/lib/server/verification";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login { email, password?, locale? } — v4.3 account-first
 * decision tree. The password field is OPTIONAL now:
 *
 *   • account EXISTS + password → GoTrue password grant → session.
 *   • account EXISTS + no password → 401 password_required (the client
 *     reveals and focuses the password field).
 *   • account EXISTS but unconfirmed (pending registration):
 *       - token still inside its 1-week window → 403 email_unverified
 *         (the client offers the resend button);
 *       - window lapsed → the registration is cancelled (user purged)
 *         and the request continues as "no account".
 *   • NO account + password typed → 200 { action: "signup_prefill" } —
 *     the client moves to /signup with e-mail + password auto-filled.
 *   • NO account + e-mail only → the pending account is created right
 *     away (random password, unconfirmed) and the verification e-mail
 *     goes out → 200 { action: "check_inbox" }. The account activates
 *     (and gets its real name + password) when the link is opened.
 *
 * A confirmed account whose completion step was skipped (the random-
 * password path) gets a fresh verification mail on a wrong password —
 * that link lands on the completion form, magic-login style.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured) return jsonError(503, "supabase_unconfigured");
  const body = await readJson(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const locale = typeof body.locale === "string" ? body.locale : "az";
  if (!email) return jsonError(400, "missing_fields");

  // ── Does an account exist for this e-mail? ────────────────────────────
  let account: Record<string, unknown> | null = null;
  try {
    account = await authAdminFindUserByEmail(email);
  } catch (e) {
    console.error("[auth:login lookup]", e);
    return jsonError(500, "generic");
  }

  // ── Existing account ──────────────────────────────────────────────────
  if (account) {
    const userId = typeof account.id === "string" ? account.id : "";

    if (!isConfirmedUser(account)) {
      // Pending registration: inside its window → "check your inbox";
      // past it → cancel (purge) and fall through to the no-account path.
      const pending = await pendingVerificationForUser(userId);
      if (!verificationExpired(pending)) {
        return jsonError(403, "email_unverified");
      }
      await purgeRegistration(userId);
      account = null;
    } else {
      if (!password) return jsonError(401, "password_required");

      let granted: Record<string, unknown>;
      try {
        granted = await authPasswordLogin(email, password);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Email not confirmed")) {
          return jsonError(403, "email_unverified");
        }
        if (msg.includes("invalid_grant") || msg.includes("Invalid login credentials")) {
          // Completion step skipped: the account holds a random password
          // nobody knows. Send a fresh link that lands on the completion
          // form instead of a dead-end "wrong password".
          const meta = account.user_metadata as Record<string, unknown> | undefined;
          if (meta?.needs_completion === true) {
            try {
              const { devLink } = await createVerification(
                userId, email, locale, originFrom(req.headers),
              );
              return NextResponse.json({ action: "check_inbox", email, devLink });
            } catch (e2) {
              console.error("[auth:login magic]", e2);
            }
          }
          return jsonError(401, "invalid_credentials");
        }
        console.error("[auth:login]", msg);
        return jsonError(500, "generic");
      }
      const user = userFromAuth(granted.user as Record<string, unknown>);
      if (!user) return jsonError(500, "generic");

      try {
        const session = await createSession(user, req.headers.get("user-agent"));
        const res = NextResponse.json({ user: userView(session.user) });
        res.cookies.set(sessionCookie(session.token, isSecure(req.headers)));
        return res;
      } catch (e) {
        console.error("[auth:login session]", e);
        return jsonError(500, "generic");
      }
    }
  }

  // ── No account (never existed, or the pending one was just purged) ────
  if (password) {
    // The visitor clearly means to register — hand the credentials to
    // the signup form (the client carries the password in sessionStorage,
    // never in the URL).
    return NextResponse.json({ action: "signup_prefill", email });
  }

  // E-mail only: start the registration right here. The account is
  // created pending (random password, unconfirmed) — it only becomes
  // real once the e-mail link is confirmed within 1 week.
  try {
    const created = await authAdminCreateUser(
      email,
      randomBytes(24).toString("base64url"), // placeholder until the completion step
      "",
      false,
      { needs_completion: true },
    );
    const user = userFromAuth(created);
    if (!user) return jsonError(500, "generic");

    const lang = locale === "en" ? "en" : locale === "ru" ? "ru" : "az";
    if (lang !== "en") {
      await supaUpdate("profiles", [["id", `eq.${user.id}`]], { lang }).catch(() => {});
    }

    const { devLink } = await createVerification(
      user.id, email, locale, originFrom(req.headers),
    );
    return NextResponse.json({ action: "check_inbox", email, devLink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // A pending user could appear between the lookup and the create
    // (double submit) — treat it as the pending state it is.
    if (msg.includes("422")) return jsonError(403, "email_unverified");
    console.error("[auth:login register]", msg);
    return jsonError(500, "generic");
  }
}
