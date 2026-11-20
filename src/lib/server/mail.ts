import nodemailer from "nodemailer";
import { supaInsert } from "./supa";

/**
 * Outgoing e-mail, three transports deep:
 *   1. Brevo HTTP API (BREVO_API_KEY) — the primary production path;
 *   2. SMTP via nodemailer (SMTP_HOST/USER/PASS) — legacy alternative;
 *   3. the mail_outbox table — the dev sandbox catch-all. When nothing
 *      sends, the signup flow surfaces the verification link on screen.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const MAIL_FROM = process.env.MAIL_FROM ?? "PreLife <no-reply@prelife.net>";

/** True when the SMTP transport can be built (host + credentials present). */
export function smtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/** True when mails can go out through the Brevo API. */
export function brevoConfigured(): boolean {
  return Boolean(BREVO_API_KEY);
}

/** Split MAIL_FROM ("PreLife <a@b.c>") into Brevo's sender shape. */
function brevoSender(): { name: string; email: string } {
  const m = MAIL_FROM.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m && m[2]) return { name: m[1] || "PreLife", email: m[2] };
  return { name: "PreLife", email: MAIL_FROM };
}

/** POST /v3/smtp/email — one message through Brevo's relay. */
async function sendViaBrevo(msg: MailMessage): Promise<boolean> {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: brevoSender(),
        to: [{ email: msg.to }],
        subject: msg.subject,
        htmlContent: msg.html,
      }),
      cache: "no-store",
    });
    if (res.ok) return true;
    console.error("[mail:brevo]", res.status, await res.text());
    return false;
  } catch (e) {
    console.error("[mail:brevo]", e);
    return false;
  }
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  kind: string;
};

/** Send one message: Brevo API, then SMTP, the outbox as the last resort. */
export async function sendMail(msg: MailMessage): Promise<{ sent: boolean }> {
  if (brevoConfigured() && (await sendViaBrevo(msg))) {
    return { sent: true };
  }
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
    footer: "Bu link 1 həftə qüvvədədir. Bu müddətdə hesabınızı təsdiqləməsəniz, qeydiyyatınız avtomatik ləğv olunacaq.",
  },
  en: {
    subject: "Confirm your e-mail — PreLife",
    heading: "Confirm your e-mail",
    body: "Open the button below to activate your account.",
    cta: "Confirm",
    footer: "This link is valid for 1 week. If you do not confirm your account within this period, your registration will be cancelled automatically.",
  },
  ru: {
    subject: "Подтвердите e-mail — PreLife",
    heading: "Подтвердите e-mail",
    body: "Откройте кнопку ниже, чтобы активировать аккаунт.",
    cta: "Подтвердить",
    footer: "Ссылка действует 1 неделю. Если не подтвердить аккаунт в течение этого срока, регистрация будет автоматически отменена.",
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

/* ── Session request outcome e-mails (v3.4 request workflow) ────────────── */

// Locale guard — anything outside az/en/ru renders as az.
const mailLang = (locale: string): "az" | "en" | "ru" =>
  locale === "en" ? "en" : locale === "ru" ? "ru" : "az";

const PAYMENT_STRINGS: Record<
  "az" | "en" | "ru",
  {
    subject: string; heading: string; body: string; cta: string; footer: string;
    psychologist: string; when: string; format: string; price: string;
    modeOnline: string; modeOffice: string;
  }
> = {
  az: {
    subject: "Seansınız təsdiqləndi — ödəniş gözlənir",
    heading: "Seansınız təsdiqləndi",
    body: "Psixoloq sorğunuuzu qəbul etdi. Vaxtınızı saxlamaq üçün ödənişi tamamlayın — ödənişdən sonra seans təsdiqlənmiş sayılır.",
    cta: "Ödənişə keç",
    footer: "Ödəniş tamamlanmayana qədər vaxt başqa müştəriyə keçə bilər.",
    psychologist: "Psixoloq",
    when: "Tarix və saat (Bakı)",
    format: "Format",
    price: "Qiymət",
    modeOnline: "Onlayn",
    modeOffice: "Kabinet",
  },
  en: {
    subject: "Your session is confirmed — payment due",
    heading: "Your session is confirmed",
    body: "The psychologist accepted your request. Complete the payment to lock the time in — the session counts as booked once it is paid.",
    cta: "Go to payment",
    footer: "Until the payment is completed, the time slot may go to another client.",
    psychologist: "Psychologist",
    when: "Date and time (Baku)",
    format: "Format",
    price: "Price",
    modeOnline: "Online",
    modeOffice: "In-office",
  },
  ru: {
    subject: "Ваш сеанс подтверждён — ожидается оплата",
    heading: "Ваш сеанс подтверждён",
    body: "Психолог принял вашу заявку. Завершите оплату, чтобы закрепить время — сеанс считается забронированным только после оплаты.",
    cta: "Перейти к оплате",
    footer: "Пока оплата не завершена, время может перейти к другому клиенту.",
    psychologist: "Психолог",
    when: "Дата и время (Баку)",
    format: "Формат",
    price: "Стоимость",
    modeOnline: "Онлайн",
    modeOffice: "Кабинет",
  },
};

/** The payment-due e-mail sent when a psychologist confirms a request. */
export function buildPaymentDueMail(
  locale: string,
  input: {
    psychologist: string;
    startAtLabel: string;
    mode: "online" | "office";
    price: number | null;
    link: string;
  },
): { subject: string; html: string } {
  const lang = mailLang(locale);
  const s = PAYMENT_STRINGS[lang];
  const safeLink = input.link.replace(/"/g, "&quot;");
  const detail = (label: string, value: string) =>
    `<tr>
      <td style="padding:6px 14px 6px 0;font-size:13px;font-weight:650;color:${MUTED};white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-size:14px;font-weight:600;color:${DEEP};">${value}</td>
    </tr>`;
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:24px;background:#f5f5f7;">
<div style="max-width:420px;margin:0 auto;padding:32px 24px;background:#ffffff;border-radius:22px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${DEEP};">
  <p style="margin:0 0 24px;font-size:18px;font-weight:700;">Pre<span style="color:${ACCENT};">Life</span></p>
  <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${DEEP};">${s.heading}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${s.body}</p>
  <table style="margin:0 0 24px;border-collapse:collapse;">
    ${detail(s.psychologist, input.psychologist)}
    ${detail(s.when, input.startAtLabel)}
    ${detail(s.format, input.mode === "office" ? s.modeOffice : s.modeOnline)}
    ${detail(s.price, input.price === null ? "—" : `${input.price} AZN`)}
  </table>
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

const DECLINED_STRINGS: Record<
  "az" | "en" | "ru",
  { subject: string; heading: string; body: string; footer: string }
> = {
  az: {
    subject: "Seans sorğunuz təsdiqlənmədi",
    heading: "Sorğunuz təsdiqlənmədi",
    body: "Təəssüf ki, bu vaxt üçün sorğunuz qəbul edilmədi. Psixoloqun cədvəlindən başqa bir vaxt seçərək yenidən sorğu göndərə bilərsiniz.",
    footer: "Sualınız olsa, bizimlə əlaqə saxlamaqdan çəkinməyin — PreLife.",
  },
  en: {
    subject: "Your session request was not confirmed",
    heading: "Your request was not confirmed",
    body: "Unfortunately, the psychologist could not take this time. You are welcome to pick another slot from the schedule and send a new request.",
    footer: "If you have any questions, feel free to reach out — PreLife.",
  },
  ru: {
    subject: "Ваша заявка на сеанс не подтверждена",
    heading: "Ваша заявка не подтверждена",
    body: "К сожалению, психолог не смог принять это время. Вы можете выбрать другое время в расписании и отправить новую заявку.",
    footer: "Если появятся вопросы — пишите нам, PreLife.",
  },
};

/** The polite decline e-mail sent when a psychologist rejects a request. */
export function buildRequestDeclinedMail(
  locale: string,
  input: { psychologist: string; startAtLabel: string },
): { subject: string; html: string } {
  const lang = mailLang(locale);
  const s = DECLINED_STRINGS[lang];
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:24px;background:#f5f5f7;">
<div style="max-width:420px;margin:0 auto;padding:32px 24px;background:#ffffff;border-radius:22px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${DEEP};">
  <p style="margin:0 0 24px;font-size:18px;font-weight:700;">Pre<span style="color:${ACCENT};">Life</span></p>
  <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${DEEP};">${s.heading}</h1>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${s.body}</p>
  <p style="margin:0 0 24px;padding:12px 16px;border-radius:14px;background:#f5f5f7;font-size:14px;line-height:1.6;color:${DEEP};">
    <b>${input.psychologist}</b> · ${input.startAtLabel}
  </p>
  <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">${s.footer}</p>
</div>
</body>
</html>`;
  return { subject: s.subject, html };
}
