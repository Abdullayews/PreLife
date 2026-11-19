"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { apiUrl } from "@/lib/api-url";
import { CheckCircle2, MailX, TimerOff } from "lucide-react";

type ResendState = "ok" | "fail" | "unknown" | null;

/**
 * The /verify card — the landing surface of the e-mail confirmation
 * link (/api/auth/verify redirects here with ?status=ok|expired|invalid,
 * plus ?email= when known). Expired and invalid links get the resend
 * form, which rotates the token through /api/auth/resend.
 */
export function VerifyPanel() {
  const sp = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("verifyPage");
  const ta = useTranslations("authPage");

  const status = sp.get("status");
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [resend, setResend] = useState<ResendState>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

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

  if (status === "ok") {
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

  const expired = status === "expired";
  return (
    <div className="auth-card">
      <span className="chip-ico">
        {expired ? <TimerOff size={26} aria-hidden /> : <MailX size={26} aria-hidden />}
      </span>
      <div className="auth-head">
        <h1 className="h2">{expired ? t("title") : t("badTitle")}</h1>
        <p className="lede">{expired ? t("expired") : t("badText")}</p>
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

      {!expired && (
        <Link href="/login" className="btn btn-ghost">{t("backToLogin")}</Link>
      )}
    </div>
  );
}
