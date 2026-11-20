import { NextResponse, type NextRequest } from "next/server";
import {
  authAdminDeleteUser,
  authAdminFindUserByEmail,
  authPkceExchange,
  isConfirmedUser,
  supaUpdate,
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
import { startMailRegistration } from "@/lib/server/verification";

export const dynamic = "force-dynamic";

/** Fallback freshness window for cookies minted before the mint stamp
 * existed (mid-flow upgrades): a GoTrue row younger than this counts as
 * "created by the OAuth dance". */
const OAUTH_NEW_WINDOW_MS = 5 * 60 * 1000;

/** How much clock drift (our server vs Supabase) the mint-stamp
 * comparison tolerates when deciding whether THIS dance created the
 * provider row. Kept small on purpose: the row's insert always happens
 * AFTER the button press, so only sync drift moves created_at backwards
 * — and mistaking a just-registered account for a phantom (deleting it
 * on the next login) is far worse than the reverse. */
const OAUTH_SKEW_MS = 15 * 1000;

/** Read the locale + mode + mint stamp + verifier packed by the oauth
 * start route ("<locale>.<mode>.<minted-ms>.<verifier>" since v4.4).
 * Earlier shapes — v4.4 ("<locale>.<mode>.<verifier>"), v4.3
 * ("<locale>.<verifier>") and bare verifiers from mid-flow upgrades —
 * parse too and default to the login rules + the 5-minute window. */
function parseOauthCookie(
  raw: string | undefined,
): { locale: string; mode: "login" | "signup"; minted: number; verifier: string | null } {
  if (!raw) return { locale: "az", mode: "login", minted: 0, verifier: null };
  const parts = raw.split(".");
  const localeOf = (s: string) => (s === "en" || s === "ru" ? s : "az");
  if (parts.length >= 4 && (parts[1] === "login" || parts[1] === "signup") && /^\d{11,}$/.test(parts[2])) {
    return {
      locale: localeOf(parts[0]),
      mode: parts[1],
      minted: Number(parts[2]),
      verifier: parts.slice(3).join("."),
    };
  }
  if (parts.length >= 3 && (parts[1] === "login" || parts[1] === "signup")) {
    return { locale: localeOf(parts[0]), mode: parts[1], minted: 0, verifier: parts.slice(2).join(".") };
  }
  const m = raw.match(/^([a-z]{2})\.(.+)$/);
  if (!m) return { locale: "az", mode: "login", minted: 0, verifier: raw };
  return { locale: localeOf(m[1]), mode: "login", minted: 0, verifier: m[2] };
}

/**
 * GET /api/auth/callback?code=… — Supabase sends the visitor back here
 * after the provider dance. Exchanges the code with the PKCE verifier,
 * mints the pl_session cookie, clears the OAuth cookie and lands the
 * user on /home. Any failure goes to /login?error=oauth.
 *
 * v4.4 — what a brand-new OAuth-only account means depends on WHERE
 * the dance started (the mode + a mint stamp ride in the pl_oauth
 * cookie):
 *
 *   • signup — the provider registration COMPLETES: the GoTrue row the
 *     dance created stays (Google/Apple already vouch for the e-mail,
 *     so no verification mail is needed), the session is minted and
 *     the visitor lands in the app. The provider button on the signup
 *     page is a registration, not a dead end.
 *
 *   • login — unknown e-mail: the phantom row is deleted again and the
 *     mail registration starts AUTOMATICALLY (v4.6): the pending
 *     account is created and the confirmation e-mail is sent right
 *     here in the callback, so the visitor lands directly on the
 *     "check your inbox" card — no Continue press, nothing to type.
 *     The mail hand-off still lives at the login place only — never
 *     on the signup page.
 *
 *   • an existing account (e-mail provider on the row) links to the
 *     provider and just logs in, from either page — but ONLY when the
 *     e-mail account is already confirmed. A pending registration is
 *     NEVER enterable: the first sign-in is the e-mail link, even when
 *     Google/Apple already linked the identity during the dance (v4.5).
 *     The visitor bounces to the login page with an "unconfirmed"
 *     notice; once the mail link is opened, provider logins work too.
 */
export async function GET(req: NextRequest) {
  if (!supabaseConfigured) {
    return fail(req);
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail(req);
  if (req.nextUrl.searchParams.get("error")) return fail(req);
  const { locale, mode, minted, verifier } = parseOauthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  if (!verifier) return fail(req);

  try {
    const exchanged = await authPkceExchange(code, verifier);
    const raw = exchanged.user as Record<string, unknown>;
    const user = userFromAuth(raw);
    if (!user) return fail(req);

    const origin = originFrom(req.headers);

    // Brand-new OAuth-only row (no "email" provider — an existing
    // e-mail account linked by Google keeps its original creation time)?
    // With the cookie's mint stamp that means "created after the button
    // was pressed" — THIS dance created it. Provider rows older than
    // the click are real registrations (v4.4 provider signups leave
    // them behind) and must never be treated as phantoms. Old cookies
    // without the stamp fall back to the 5-minute window.
    const appMeta = (raw.app_metadata ?? {}) as Record<string, unknown>;
    const providers = Array.isArray(appMeta.providers)
      ? appMeta.providers.map(String)
      : [];
    const createdMs = typeof raw.created_at === "string" ? Date.parse(raw.created_at) : NaN;
    const fresh = minted > 0
      ? Number.isFinite(createdMs) && createdMs >= minted - OAUTH_SKEW_MS
      : Number.isFinite(createdMs) && Date.now() - createdMs < OAUTH_NEW_WINDOW_MS;
    if (fresh && !providers.includes("email")) {
      if (mode === "signup") {
        // The registration completes through the provider — the GoTrue
        // row the dance created IS the account (Google/Apple already
        // vouch for the e-mail, so no verification mail is needed).
        // Match the e-mail signup's touch: the profile starts in the
        // visitor's language.
        if (locale !== "en") {
          await supaUpdate(
            "profiles",
            [["id", `eq.${user.id}`]],
            { lang: locale },
          ).catch(() => {});
        }
        const session = await createSession(user, req.headers.get("user-agent"));
        const res = NextResponse.redirect(`${origin}/home`, 302);
        res.cookies.set(sessionCookie(session.token, isSecure(req.headers)));
        res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
        return res;
      }

      // Login rules (v4.6): no account for this e-mail → the hand-off
      // is AUTOMATIC. The phantom row goes away, the pending account is
      // created and the confirmation e-mail is sent right here — the
      // visitor lands directly on the "check your inbox" card, with no
      // form to fill and no button to press. The provider already gave
      // us the e-mail; the registration starts itself.
      await authAdminDeleteUser(user.id).catch((e) => {
        console.warn("[auth:callback] phantom delete failed", e);
      });
      try {
        const { devLink } = await startMailRegistration(user.email, locale, origin);
        const qs = new URLSearchParams({ email: user.email, notice: "mail_sent" });
        // Dev sandbox only (production mails go out for real and never
        // produce a dev link): surface the link instead of the mail.
        if (devLink) qs.set("devlink", devLink);
        const res = NextResponse.redirect(`${origin}/${locale}/login?${qs.toString()}`, 302);
        res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
        return res;
      } catch (e) {
        // Rare (e.g. the phantom delete lagged and the e-mail is still
        // taken) — fall back to the manual screen: the e-mail arrives
        // prefilled and Continue re-runs the same registration.
        console.error("[auth:callback mail hand-off]", e);
        const res = NextResponse.redirect(
          `${origin}/${locale}/login`
          + `?email=${encodeURIComponent(user.email)}`
          + `&notice=oauth_new`,
          302,
        );
        res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
        return res;
      }
    }

    // An e-mail account behind the provider button? It must already be
    // CONFIRMED — a pending registration is only ever activated by the
    // e-mail link (the first sign-in). The authoritative check is the
    // admin view; the raw exchange shape is the fallback.
    if (providers.includes("email")) {
      let account: Record<string, unknown> | null = null;
      try {
        account = await authAdminFindUserByEmail(user.email);
      } catch {
        /* fall back to the raw shape below */
      }
      const confirmed = account
        ? isConfirmedUser(account)
        : isConfirmedUser(raw);
      if (!confirmed) {
        const res = NextResponse.redirect(
          `${origin}/${locale}/login`
            + `?email=${encodeURIComponent(user.email)}`
            + `&notice=unconfirmed`,
          302,
        );
        res.cookies.set(clearedOAuthCookie(isSecure(req.headers)));
        return res;
      }
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
