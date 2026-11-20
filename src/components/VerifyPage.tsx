"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { apiUrl } from "@/lib/api-url";
import { CheckCircle2, MailX, TimerOff, UserRoundPlus } from "lucide-react";

type ResendState = "ok" | "fail" | "unknown" | null;

/**
 * The /verify card — the landing surface of the e-mail confirmation
 * link (/api/auth/verify redirects here with ?status=ok|expired|invalid,
 * plus ?email= when known and ?complete=1 for accounts that still need
 * their name + password — the login-page "e-mail only" registrations).
 *
 * v4.3: an expired link means the 1-week window lapsed and the pending
 * registration was cancelled server-side — the card says so and points
 * at the signup form (e-mail prefilled) instead of offering a resend.
 * Invalid links keep the resend form (a pending user with a mangled
 * link still has a live token).
 */
export function VerifyPanel() {
  const sp = useSearchParams();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("verifyPage");
  const ta = useTranslations("authPage");

  const status = sp.get("status");
  const complete = sp.get("complete") === "1";
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [resend, setResend] = useState<ResendState>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  // ── Completion form (name + password for mail-started accounts) ──────
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [completeError, setCompleteError] = useState<string | null>(null);

  const onResend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setResend(null);
    setDevLink(null);
    try {
      const res = await fetch(apiUrl("/api/auth/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (res.status === 404) {
        setResend("unknown");
        return;
      }
      if (!res.ok) {
        setResend("fail");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { devLink?: string };
      setDevLink(typeof body.devLink === "string" ? body.devLink : null);
      setResend("ok");
    } catch {
      setResend("fail");
    } finally {
      setBusy(false);
    }
  };

  const onComplete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCompleteError(null);
    if (password !== password2) {
      setCompleteError("mismatch");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/auth/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setCompleteError(body.error === "short_password" ? "short_password" : "fail");
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setCompleteError("fail");
    } finally {
      setBusy(false);
    }
  };

  // ── status=ok: plain success, or the completion form ─────────────────
  if (status === "ok") {
    if (complete) {
      return (
        <div className="auth-card">
          <span className="chip-ico solid"><UserRoundPlus size={26} aria-hidden /></span>
          <div className="auth-head">
            <h1 className="h2">{t("completeTitle")}</h1>
            <p className="lede">{t("completeText")}</p>
          </div>

          <form className="auth-form" onSubmit={onComplete}>
            <div className="field">
              <label htmlFor="complete-name">{ta("name")}</label>
              <input
                id="complete-name"
                name="name"
                type="text"
                placeholder={ta("namePlaceholder")}
                autoComplete="name"
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="complete-password">{ta("password")}</label>
              <input
                id="complete-password"
                name="password"
                type="password"
                placeholder={ta("passwordPlaceholder")}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="complete-password2">{t("passwordRepeat")}</label>
              <input
                id="complete-password2"
                name="password2"
                type="password"
                placeholder={ta("passwordPlaceholder")}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={100}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </div>
            {completeError && (
              <p className="field-error" role="alert">
                {completeError === "mismatch"
                  ? t("passwordMismatch")
                  : completeError === "short_password"
                    ? ta("errors.short_password")
                    : t("completeFail")}
              </p>
            )}
            <button type="submit" className="btn btn-lg" disabled={busy}>
              {t("completeCta")}
            </button>
          </form>
        </div>
      );
    }
    return (
      <div className="auth-card">
        <span className="chip-ico solid"><CheckCircle2 size={26} aria-hidden /></span>
        <div className="auth-head">
          <h1 className="h2">{t("okTitle")}</h1>
          <p className="lede">{t("okText")}</p>
        </div>
        <Link href="/home" className="btn">{t("goHome")}</Link>
      </div>
    );
  }

  // ── status=expired: the registration was cancelled — start over ─────
  const expired = status === "expired";
  if (expired) {
    return (
      <div className="auth-card">
        <span className="chip-ico"><TimerOff size={26} aria-hidden /></span>
        <div className="auth-head">
          <h1 className="h2">{t("cancelledTitle")}</h1>
          <p className="lede">{t("cancelledText")}</p>
        </div>
        <Link
          href={`/signup?email=${encodeURIComponent(email)}`}
          className="btn btn-lg"
        >
          {t("signupAgain")}
        </Link>
        <Link href="/welcome" className="back auth-back">{ta("backToWelcome")}</Link>
      </div>
    );
  }

  // ── status=invalid (or unknown): the resend form ─────────────────────
  return (
    <div className="auth-card">
      <span className="chip-ico"><MailX size={26} aria-hidden /></span>
      <div className="auth-head">
        <h1 className="h2">{t("badTitle")}</h1>
        <p className="lede">{t("badText")}</p>
      </div>

      <form className="auth-form" onSubmit={onResend}>
        <div className="field">
          <label htmlFor="verify-email">{ta("email")}</label>
          <input
            id="verify-email"
            name="email"
            type="email"
            inputMode="email"
            placeholder={ta("emailPlaceholder")}
            autoComplete="email"
            required
            maxLength={120}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {resend === "ok" && <p className="set-note">{t("resent")}</p>}
        {resend === "unknown" && <p className="field-error" role="alert">{ta("resendUnknown")}</p>}
        {resend === "fail" && <p className="field-error" role="alert">{ta("resendFail")}</p>}
        <button type="submit" className="btn btn-lg" disabled={busy}>
          {t("resend")}
        </button>
      </form>

      {devLink && (
        <div className="auth-demo">
          {ta("devLinkNote")}{" "}
          <a className="forgot" href={devLink} target="_blank" rel="noreferrer">{ta("devLinkOpen")}</a>
        </div>
      )}

      <Link href="/login" className="btn btn-ghost">{t("backToLogin")}</Link>
    </div>
  );
}
