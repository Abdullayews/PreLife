"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api-url";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { safeNext } from "@/lib/next-url";

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

/**
 * Classic email + password form shared by /login and /signup, with
 * Google / Apple buttons wired to the real OAuth flow (GET
 * /api/auth/oauth/<provider> → Supabase /authorize with PKCE →
 * /api/auth/callback mints the session). The buttons are full page
 * navigations: the OAuth dance cannot run inside fetch.
 */
export function AuthForm({ mode, next, oauthError }: { mode: "login" | "signup"; next?: string; oauthError?: boolean }) {
  const t = useTranslations("authPage");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(oauthError ? "oauth" : null);
  const [showPw, setShowPw] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/auth/${mode}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "generic");
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

  const otherHref = (mode === "login" ? "/signup" : "/login") + (next ? `?next=${encodeURIComponent(next)}` : "");

  // Full page navigation — the OAuth redirect chain cannot run in fetch.
  const startOauth = (provider: "google" | "apple") => {
    window.location.href = apiUrl(`/api/auth/oauth/${provider}`);
  };

  return (
    <div className="auth-card">
      <Link href="/welcome" className="brand" aria-label="PreLife">
        Pre<em>Life</em>
      </Link>

      <div className="auth-head">
        <h1 className="h2">{mode === "login" ? t("loginTitle") : t("signupTitle")}</h1>
        <p className="lede">{mode === "login" ? t("loginSubtitle") : t("signupSubtitle")}</p>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "signup" && (
          <div className="field">
            <label htmlFor="name">{t("name")}</label>
            <input id="name" name="name" type="text" placeholder={t("namePlaceholder")} autoComplete="name" required maxLength={60} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t("email")}</label>
          <input id="email" name="email" type="email" inputMode="email" placeholder={t("emailPlaceholder")} autoComplete="email" required maxLength={120} />
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
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              maxLength={100}
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
        </div>

        {error && (
          <p className="field-error" role="alert">
            {t(`errors.${error}`)}
          </p>
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
