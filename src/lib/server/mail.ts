import nodemailer from "nodemailer";
import { supaInsert } from "./supa";

/**
 * Outgoing e-mail — SMTP when configured, a database outbox otherwise.
 *
 * Production sets SMTP_HOST/USER/PASS and mails go out through nodemailer.
 * The sandbox leaves them empty, so every message is written to the
 * mail_outbox table (visible in the emulator store) and the signup flow
 * surfaces the verification link directly on screen instead.
 */

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const MAIL_FROM = process.env.MAIL_FROM ?? "PreLife <no-reply@prelife.app>";

/** True when the SMTP transport can be built (host + credentials present). */
export function smtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  kind: string;
};

/** Send one message: SMTP first, outbox as the fallback. */
export async function sendMail(msg: MailMessage): Promise<{ sent: boolean }> {
  if (smtpConfigured()) {
    try {
      const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        pool: false,
      });
      await transport.sendMail({ from: MAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html });
      return { sent: true };
    } catch (e) {
      console.error("[mail:smtp]", e); // fall through to the outbox
    }
  }
  try {
    await supaInsert("mail_outbox", {
      to_email: msg.to,
      subject: msg.subject,
      html: msg.html,
      kind: msg.kind,
    });
  } catch (e) {
    console.error("[mail:outbox insert]", e);
  }
  console.log("[mail:outbox]", msg.to, msg.subject);
  return { sent: false };
}

/* ── Verification e-mail ────────────────────────────────────────────────── */

// The shell palette from globals.css :root (--accent / --deep).
const ACCENT = "#7b2d3b";
const DEEP = "#2b1a1e";
const MUTED = "#6e6e73";

const VERIFICATION_STRINGS: Record<
  "az" | "en" | "ru",
  { subject: string; heading: string; body: string; cta: string; footer: string }
> = {
  az: {
    subject: "E-poçtunu təsdiqlə — PreLife",
    heading: "E-poçtunu təsdiqlə",
    body: "Hesabınızı aktivləşdirmək üçün aşağıdakı düyməni açın.",
    cta: "Təsdiqlə",
    footer: "Bu link 24 saat qüvvədədir.",
  },
  en: {
    subject: "Confirm your e-mail — PreLife",
    heading: "Confirm your e-mail",
    body: "Open the button below to activate your account.",
    cta: "Confirm",
    footer: "This link is valid for 24 hours.",
  },
  ru: {
    subject: "Подтвердите e-mail — PreLife",
    heading: "Подтвердите e-mail",
    body: "Откройте кнопку ниже, чтобы активировать аккаунт.",
    cta: "Подтвердить",
    footer: "Ссылка действительна 24 часа.",
  },
};

/** The confirmation e-mail — plain centered HTML, no tables, no images. */
export function verificationEmailHtml(
  locale: string,
  link: string,
): { subject: string; html: string } {
  const lang = locale === "en" ? "en" : locale === "ru" ? "ru" : "az";
  const s = VERIFICATION_STRINGS[lang];
  const safeLink = link.replace(/"/g, "&quot;");
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:24px;background:#f5f5f7;">
<div style="max-width:420px;margin:0 auto;padding:32px 24px;background:#ffffff;border-radius:22px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${DEEP};">
  <p style="margin:0 0 24px;font-size:18px;font-weight:700;">Pre<span style="color:${ACCENT};">Life</span></p>
  <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${DEEP};">${s.heading}</h1>
  <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:${MUTED};">${s.body}</p>
  <p style="margin:0 0 28px;text-align:center;">
    <a href="${safeLink}" style="display:inline-block;padding:13px 34px;border-radius:999px;background:${ACCENT};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${s.cta}</a>
  </p>
  <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;">
    <a href="${safeLink}" style="color:${ACCENT};">${safeLink}</a>
  </p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">${s.footer}</p>
</div>
</body>
</html>`;
  return { subject: s.subject, html };
}
