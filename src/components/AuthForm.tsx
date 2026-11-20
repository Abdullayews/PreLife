"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNext } from "@/lib/next-url";

/** sessionStorage key that carries the password from the login form to
 * the signup form (never the URL — URLs end up in history and logs). */
const PREFILL_KEY = "prelife:signup-prefill";

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.18l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 8.7104c-.18-.54-.2823-1.1168-.2823-1.7104s.1023-1.1705.2823-1.7104V2.9581H.9573C.3477 4.1732 0 5.5477 0 7s.3477 2.8268.9573 4.0419l3.0067-2.3315z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3462l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9581L3.964 7.2896C4.6718 5.1623 6.6559 3.5795 9 3.5795z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/** The dashed dev box: no mail transport is configured in the sandbox,
 * so the verification link is surfaced right on screen instead. */
function DevLinkBox({ note, open, href }: { note: string; open: string; href: string }) {
  return (
    <div className="auth-demo">
      {note}{" "}
      <a className="forgot" href={href} target="_blank" rel="noreferrer">{open}</a>
    </div>
  );
}

/** The banner shown when a visitor arrives back on the LOGIN page
 * from a Google/Apple login that found no account (the manual
 * fallback of the v4.6 automatic hand-off — the callback's mail send
 * failed, so Continue re-runs the registration). */
function NoticeBox({ text }: { text: string }) {
  return <output className="set-note">{text}</output>;
}

/**
 * Classic email + password form shared by /login and /signup, with
 * Google / Apple buttons wired to the real OAuth flow (GET
 * /api/auth/oauth/<provider> → Supabase /authorize with PKCE →
 * /api/auth/callback mints the session). The buttons are full page
 * navigations: the OAuth dance cannot run inside fetch.
 *
 * v4.3 account-first rules:
 *   • Signup keeps its "check your inbox" activation state (1-week link).
 *   • Login accepts an e-mail WITHOUT a password: a new address starts
 *     the registration right there (verification mail, account created
 *     on confirm), an existing one asks for the password.
 *   • Login with e-mail + password on an unknown address moves the
 *     visitor to /signup with both fields auto-filled (the password
 *     travels via sessionStorage, never the URL).
 *
 * v4.4 provider rules (the origin page rides through the OAuth flow):
 *   • A Google/Apple SIGNUP with no account registers right there —
 *     the provider vouches for the e-mail, the account is created and
 *     the visitor lands in the app. The provider button on /signup is
 *     a registration, never a bounce to the e-mail form.
 *   • A Google/Apple LOGIN with no account hands off to the mail
 *     registration AUTOMATICALLY (v4.6): the callback creates the
 *     pending account and sends the confirmation e-mail itself, then
 *     lands the visitor here straight on the "check your inbox" card
 *     (notice="mail_sent") — no Continue press, nothing to type. The
 *     notice="oauth_new" banner is only the rare fallback for when
 *     that automatic send failed.
 *   • A Google/Apple login onto an UNCONFIRMED e-mail account also
 *     lands here (v4.5): the first sign-in is the mail link, always —
 *     the notice tells the visitor to confirm the account first.
 */
export function AuthForm({
  mode,
  next,
  oauthError,
  prefillEmail,
  notice,
  mailDevLink,
}: {
  mode: "login" | "signup";
  next?: string;
  oauthError?: boolean;
  prefillEmail?: string;
  notice?: "oauth_new" | "unconfirmed" | "mail_sent" | null;
  mailDevLink?: string | null;
}) {
  const t = useTranslations("authPage");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(oauthError ? "oauth" : null);
  const [showPw, setShowPw] = useState(false);

  // v4.3: controlled e-mail + password (prefill support).
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const pwRef = useRef<HTMLInputElement>(null);

  // Signup: pull the password stashed by the login form (once, then
  // drop it — sessionStorage is not a vault).
  useEffect(() => {
    if (mode !== "signup") return;
    try {
      const raw = sessionStorage.getItem(PREFILL_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PREFILL_KEY);
      const v = JSON.parse(raw) as { email?: string; password?: string };
      if (typeof v.email === "string" && !prefillEmail) setEmail(v.email);
      if (typeof v.password === "string") setPassword(v.password);
    } catch {
      /* corrupt stash — ignore */
    }
  }, [mode, prefillEmail]);

  // Signup success: the "check your inbox" state replaces the form.
  // v4.6: it also STARTS there — notice="mail_sent" means the OAuth
  // callback already sent the confirmation mail (the Google/Apple
  // hand-off), so the form never shows at all.
  const [signedUp, setSignedUp] = useState<{ email: string; devLink: string | null } | null>(
    () => (notice === "mail_sent" && prefillEmail
      ? { email: prefillEmail, devLink: mailDevLink ?? null }
      : null),
  );
  // Login on an unconfirmed account: the resend flow below the error.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendState, setResendState] = useState<"ok" | "fail" | "unknown" | null>(null);
  const [resendDevLink, setResendDevLink] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "");
    setBusy(true);
    try {
      // The locale rides both calls so the verification e-mail matches.
      const res = await fetch(apiUrl(`/api/auth/${mode}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password, locale } : { email, password, locale }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (mode === "login" && body.error === "email_unverified") {
          setUnverifiedEmail(email);
        }
        if (mode === "login" && body.error === "password_required") {
          pwRef.current?.focus();
        }
        setError(body.error ?? "generic");
        return;
      }

      if (mode === "signup") {
        const body = (await res.json().catch(() => ({}))) as { email?: string; devLink?: string };
        setSignedUp({
          email: typeof body.email === "string" ? body.email : email,
          devLink: typeof body.devLink === "string" ? body.devLink : null,
        });
        return;
      }

      // Login — three success shapes.
      const body = (await res.json().catch(() => ({}))) as {
        user?: unknown;
        action?: string;
        email?: string;
        devLink?: string | null;
      };
      if (body.action === "signup_prefill") {
        // No account + password typed: continue on the signup form with
        // the credentials carried over (password via sessionStorage).
        try {
          sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ email, password }));
        } catch {
          /* private mode — the e-mail param still prefills */
        }
        const qs = new URLSearchParams({ email });
        if (next) qs.set("next", next);
        router.push(`/signup?${qs.toString()}`);
        return;
      }
      if (body.action === "check_inbox") {
        // No account + e-mail only: the registration mail just went out.
        setSignedUp({
          email: typeof body.email === "string" ? body.email : email,
          devLink: typeof body.devLink === "string" ? body.devLink : null,
        });
        return;
      }
      router.push(safeNext(next) ?? "/home");
      router.refresh();
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  // Rotates the pending verification token and re-sends the e-mail.
  const resendVerification = async () => {
    if (!unverifiedEmail) return;
    setResendBusy(true);
    setResendState(null);
    setResendDevLink(null);
    try {
      const res = await fetch(apiUrl("/api/auth/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail, locale }),
      });
      if (res.status === 404) {
        setResendState("unknown");
        return;
      }
      if (!res.ok) {
        setResendState("fail");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { devLink?: string };
      setResendDevLink(typeof body.devLink === "string" ? body.devLink : null);
      setResendState("ok");
    } catch {
      setResendState("fail");
    } finally {
      setResendBusy(false);
    }
  };

  const otherHref = (mode === "login" ? "/signup" : "/login") + (next ? `?next=${encodeURIComponent(next)}` : "");

  // Full page navigation — the OAuth redirect chain cannot run in fetch.
  // v4.4: the mode rides along so the callback knows whether a brand-new
  // provider account completes the registration (signup) or comes back
  // here for the mail flow (login).
  const startOauth = (provider: "google" | "apple") => {
    window.location.href = apiUrl(`/api/auth/oauth/${provider}?locale=${locale}&mode=${mode}`);
  };

  // Signup (or the login-page mail start) succeeded — "check your inbox".
  if (signedUp) {
    return (
      <div className="auth-card">
        <Link href="/welcome" className="brand" aria-label="PreLife">
          Pre<em>Life</em>
        </Link>

        <div className="auth-head">
          <h1 className="h2">{t("signupOkTitle")}</h1>
          <p className="lede">{t("signupOkText", { email: signedUp.email })}</p>
        </div>

        <p className="set-note">{t("signupOkNote")}</p>

        {signedUp.devLink && (
          <DevLinkBox note={t("devLinkNote")} open={t("devLinkOpen")} href={signedUp.devLink} />
        )}

        <Link href="/welcome" className="back auth-back">
          <ArrowLeft size={16} aria-hidden />{t("backToWelcome")}
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <Link href="/welcome" className="brand" aria-label="PreLife">
        Pre<em>Life</em>
      </Link>

      <div className="auth-head">
        <h1 className="h2">{mode === "login" ? t("loginTitle") : t("signupTitle")}</h1>
        <p className="lede">{mode === "login" ? t("loginSubtitle") : t("signupSubtitle")}</p>
      </div>

      {mode === "login" && notice === "oauth_new" && (
        <NoticeBox text={t("oauthLoginNotice")} />
      )}
      {mode === "login" && notice === "unconfirmed" && (
        <NoticeBox text={t("unconfirmedNotice")} />
      )}
      {mode === "signup" && password && (
        <NoticeBox text={t("prefillNote")} />
      )}

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">{t("name")}</label>
            <input id="name" name="name" type="text" placeholder={t("namePlaceholder")} autoComplete="name" required maxLength={60} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t("email")}</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            required
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="field-row">
            <label htmlFor="password">{t("password")}</label>
            {mode === "login" && (
              <Link className="forgot" href="/help">{t("forgotPassword")}</Link>
            )}
          </div>
          <div className="field-pw">
            <input
              ref={pwRef}
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required={mode === "signup"}
              minLength={mode === "signup" ? 8 : undefined}
              maxLength={100}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="pw-toggle"
              aria-pressed={showPw}
              aria-label={showPw ? t("hidePassword") : t("showPassword")}
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
            </button>
          </div>
          {mode === "login" && <p className="set-note">{t("passwordOptional")}</p>}
        </div>

        {error && (
          <p className="field-error" role="alert">
            {error === "email_unverified"
              ? t("loginUnverified")
              : error === "password_required"
                ? t("loginNeedsPassword")
                : t(`errors.${error}`)}
          </p>
        )}

        {mode === "login" && error === "email_unverified" && (
          <>
            {resendState === "ok" ? (
              <>
                <p className="set-note">{t("resendOk")}</p>
                {resendDevLink && (
                  <DevLinkBox note={t("devLinkNote")} open={t("devLinkOpen")} href={resendDevLink} />
                )}
              </>
            ) : resendState === "unknown" ? (
              <p className="field-error" role="alert">{t("resendUnknown")}</p>
            ) : resendState === "fail" ? (
              <p className="field-error" role="alert">{t("resendFail")}</p>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={resendVerification} disabled={resendBusy}>
                {t("resendCta")}
              </button>
            )}
          </>
        )}

        <button type="submit" className="btn btn-lg" disabled={busy}>
          {mode === "login" ? t("loginCta") : t("signupCta")}
          <ArrowRight size={16} aria-hidden />
        </button>
      </form>

      <div className="auth-or">{t("orContinueWith")}</div>

      <div className="auth-social">
        <button
          type="button"
          className="social-btn"
          onClick={() => startOauth("google")}
        >
          <GoogleIcon />{t("google")}
        </button>
        <button
          type="button"
          className="social-btn"
          onClick={() => startOauth("apple")}
        >
          <AppleIcon />{t("apple")}
        </button>
      </div>

      <p className="auth-alt">
        {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
        <Link href={otherHref}>{mode === "login" ? t("signUpLink") : t("signInLink")}</Link>
      </p>

      <Link href="/welcome" className="back auth-back">
        <ArrowLeft size={16} aria-hidden />{t("backToWelcome")}
      </Link>
    </div>
  );
}
