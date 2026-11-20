import nodemailer from "nodemailer";
import { supaInsert } from "./supa";

/**
 * Outgoing e-mail, three transports deep:
 *   1. Brevo HTTP API (BREVO_API_KEY) — the primary production path;
 *   2. SMTP via nodemailer (SMTP_HOST/USER/PASS) — legacy alternative;
 *   3. the mail_outbox table — the dev sandbox catch-all. When nothing
 *      sends, the signup flow surfaces the verification link on screen.
 *
 * v4.5: all three templates share one modern shell — the brand palette
 * from globals.css (bg #f5f5f7, card #ffffff, accent #7b2d3b, ink
 * #1d1d1f, muted #6e6e73, radius 22px) plus a dark-mode rendition via
 * prefers-color-scheme, and a header that mirrors the site's brand row:
 * the wand-mark tile (✦ in wand gold on near-black — the e-mail-safe
 * stand-in for the golden wand icon, since Gmail/Outlook strip SVG
 * images) next to the "PreLife" wordmark with the accent dot.
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

/** Send one message: Brevo API, then SMTP, the outbox as the last resort.
 * The sandbox (SUPABASE_EMU=1) never talks to the real transports — its
 * fake @emu.prelife.dev addresses must not burn the Brevo quota as
 * bounces — so everything lands in the outbox and the flows surface the
 * link on screen instead. */
export async function sendMail(msg: MailMessage): Promise<{ sent: boolean }> {
  if (process.env.SUPABASE_EMU === "1") {
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

/* ── The shared shell ──────────────────────────────────────────────────────
 *
 * The site palette (globals.css :root, default light theme) + the wand
 * tile colors from public/logo.svg. Email clients strip <style> to
 * varying degrees, so every color also lives inline; the classes only
 * carry the prefers-color-scheme dark overrides (Apple Mail, Outlook
 * iOS/com and Thunderbird honor them — Gmail web falls back to light).
 */

const INK = "#1d1d1f";
const ACCENT = "#7b2d3b";
const MUTED = "#6e6e73";
const TILE = "#0b0b0d"; // the logo's near-black tile
const WAND = "#e0b45c"; // the wand's mid gold
const FONT = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Escape text for HTML bodies and attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The ✦ four-pointed sparkle (U+2726) — the light source of the wand mark.
const SPARKLE = "&#10022;";

/** The brand header row — the wand tile + wordmark, like the site's
 * .brand (italic accent "Life" + the trailing accent dot). */
function brandHeader(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="42" height="42" valign="middle" style="width:42px;height:42px;background:${TILE};border-radius:12px;text-align:center;vertical-align:middle;">
      <span style="font-family:${FONT};font-size:20px;line-height:42px;color:${WAND};">${SPARKLE}</span>
    </td>
    <td class="pl-ink" style="padding-left:12px;font-family:${FONT};font-size:17px;font-weight:700;line-height:42px;color:${INK};">
      Pre<span style="color:${ACCENT};font-style:italic;">Life</span><span style="color:${ACCENT};font-size:13px;">&nbsp;&#8226;</span>
    </td>
  </tr>
</table>`;
}

/** The CTA — a padded accent pill (rounded corners degrade gracefully
 * in Outlook; the tap target and colors survive everywhere). */
function ctaButton(href: string, label: string): string {
  const safe = esc(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 10px;">
  <tr>
    <td style="border-radius:999px;background:${ACCENT};">
      <a href="${safe}" style="display:inline-block;padding:14px 38px;border-radius:999px;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

/** The raw-link fallback for clients that clip buttons. */
function linkFallback(href: string): string {
  const safe = esc(href);
  return `<p class="pl-muted" style="margin:0 0 20px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;text-align:center;">
  <a href="${safe}" style="color:${MUTED};text-decoration:underline;">${safe}</a>
</p>`;
}

/** A soft info chip (validity notes, meta details). */
function chip(html: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td class="pl-chip" style="background:#f5f5f7;border-radius:12px;padding:12px 16px;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${MUTED};">${html}</td></tr>
</table>`;
}

const AUTO_NOTE: Record<"az" | "en" | "ru", string> = {
  az: "Bu mesaj avtomatik göndərilmişdir — buraya cavab yazmağa ehtiyac yoxdur.",
  en: "This message was sent automatically — there is no need to reply.",
  ru: "Это сообщение отправлено автоматически — отвечать на него не нужно.",
};

/** One e-mail: outer background, the rounded card (brand header, content
 * slot, rule + muted note) and the tiny auto-footer under the card. */
function mailShell(
  lang: "az" | "en" | "ru",
  subject: string,
  content: string,
  note: string,
): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  body{margin:0;padding:0;}
  a{text-decoration:none;}
  @media (prefers-color-scheme: dark){
    .pl-bg{background:#0d0d0f !important;}
    .pl-card{background:#161618 !important;border-color:rgba(245,245,247,.12) !important;}
    .pl-ink{color:#f5f5f7 !important;}
    .pl-muted{color:#a1a1a6 !important;}
    .pl-chip{background:rgba(245,245,247,.06) !important;}
    .pl-hr{border-color:rgba(245,245,247,.12) !important;}
  }
</style>
</head>
<body class="pl-bg" style="margin:0;padding:36px 16px;background:#f5f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="pl-bg" style="background:#f5f5f7;">
<tr><td align="center">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="460" class="pl-card" style="width:460px;max-width:100%;background:#ffffff;border:1px solid rgba(29,29,31,.10);border-radius:22px;">
  <tr><td style="padding:30px 32px 0;">${brandHeader()}</td></tr>
  <tr><td style="padding:26px 32px 0;">${content}</td></tr>
  <tr><td style="padding:24px 32px 30px;">
    <hr class="pl-hr" style="border:none;border-top:1px solid rgba(29,29,31,.10);margin:0 0 14px;">
    <p class="pl-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">${note}</p>
  </td></tr>
</table>

<p class="pl-muted" style="margin:14px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${MUTED};">PreLife &#8226; ${AUTO_NOTE[lang]}</p>

</td></tr>
</table>
</body>
</html>`;
}

/* ── Verification e-mail (the first sign-in link) ───────────────────────── */

const VERIFICATION_STRINGS: Record<
  "az" | "en" | "ru",
  { subject: string; heading: string; body: string; cta: string; validity: string; note: string }
> = {
  az: {
    subject: "Hesabınızı təsdiqləyin — PreLife",
    heading: "Hesabınızı təsdiqləyin",
    body: "Bu link ilk girişinizdir: düyməni açdıqda hesabınız təsdiqlənir və avtomatik daxil olursunuz. Sonrakı girişlərdə e-poçt və şifrənizlə normal daxil ola bilərsiniz.",
    cta: "Təsdiqlə və daxil ol",
    validity: "Link 1 həftə qüvvədədir — bu müddətdə hesabınızı təsdiqləməsəniz, qeydiyyat avtomatik ləğv olunacaq.",
    note: "Bu hesabı siz açmamısınızsa, bu e-poçtu nəzərə almayın — heç nə dəyişməyəcək.",
  },
  en: {
    subject: "Confirm your account — PreLife",
    heading: "Confirm your account",
    body: "This link is your first sign-in: open the button and your account is confirmed with you signed in automatically. On later visits, simply sign in with your e-mail and password.",
    cta: "Confirm & sign in",
    validity: "The link is valid for 1 week — if you do not confirm within that time, the registration is cancelled automatically.",
    note: "If you did not create this account, just ignore this e-mail — nothing will change.",
  },
  ru: {
    subject: "Подтвердите аккаунт — PreLife",
    heading: "Подтвердите аккаунт",
    body: "Эта ссылка — ваш первый вход: откройте кнопку, аккаунт подтвердится, и вы войдёте автоматически. В дальнейшем входите как обычно — e-mail и пароль.",
    cta: "Подтвердить и войти",
    validity: "Ссылка действует 1 неделю — если за это время не подтвердить аккаунт, регистрация будет автоматически отменена.",
    note: "Если вы не создавали этот аккаунт, просто проигнорируйте это письмо — ничего не изменится.",
  },
};

/** The confirmation e-mail — the first-sign-in link, framed as exactly
 * that (confirm + automatic sign-in; normal e-mail/password afterwards). */
export function verificationEmailHtml(
  locale: string,
  link: string,
): { subject: string; html: string } {
  const lang = locale === "en" ? "en" : locale === "ru" ? "ru" : "az";
  const s = VERIFICATION_STRINGS[lang];
  const content = `
  <h1 class="pl-ink" style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${s.heading}</h1>
  <p class="pl-muted" style="margin:0 0 26px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">${s.body}</p>
  ${ctaButton(link, s.cta)}
  ${linkFallback(link)}
  ${chip(s.validity)}`;
  return { subject: s.subject, html: mailShell(lang, s.subject, content, s.note) };
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
    body: "Psixoloq sorğunuzu qəbul etdi. Vaxtınızı saxlamaq üçün ödənişi tamamlayın — ödənişdən sonra seans təsdiqlənmiş sayılır.",
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
  const detail = (label: string, value: string) =>
    `<tr>
      <td class="pl-muted" style="padding:7px 18px 7px 0;font-family:${FONT};font-size:13px;font-weight:600;color:${MUTED};white-space:nowrap;vertical-align:top;">${label}</td>
      <td class="pl-ink" style="padding:7px 0;font-family:${FONT};font-size:14px;font-weight:600;color:${INK};">${value}</td>
    </tr>`;
  const content = `
  <h1 class="pl-ink" style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${s.heading}</h1>
  <p class="pl-muted" style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">${s.body}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-collapse:collapse;">
    ${detail(s.psychologist, esc(input.psychologist))}
    ${detail(s.when, esc(input.startAtLabel))}
    ${detail(s.format, input.mode === "office" ? s.modeOffice : s.modeOnline)}
    ${detail(s.price, input.price === null ? "—" : `${input.price} AZN`)}
  </table>
  ${ctaButton(input.link, s.cta)}
  ${linkFallback(input.link)}`;
  return { subject: s.subject, html: mailShell(lang, s.subject, content, s.footer) };
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
  const content = `
  <h1 class="pl-ink" style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${INK};">${s.heading}</h1>
  <p class="pl-muted" style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">${s.body}</p>
  ${chip(`<b class="pl-ink" style="color:${INK};">${esc(input.psychologist)}</b> &middot; ${esc(input.startAtLabel)}`)}`;
  return { subject: s.subject, html: mailShell(lang, s.subject, content, s.footer) };
}
