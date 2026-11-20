//! Outgoing e-mail — Brevo API primary, the mail_outbox table as the
//! sandbox catch-all (the Rust service drops the legacy SMTP path; Brevo
//! is the production transport). The three templates keep the exact
//! v4.5 brand shell (palette, dark-mode overrides, wand-mark header).

use crate::state::St;
use crate::util::*;
use serde_json::{json, Value};

pub struct MailMessage {
    pub to: String,
    pub subject: String,
    pub html: String,
    pub kind: String,
}

/// Split MAIL_FROM ("PreLife <a@b.c>") into Brevo's sender shape.
fn brevo_sender(from: &str) -> (String, String) {
    // ^\s*(.*?)\s*<([^>]+)>\s*$
    if let (Some(lt), Some(_)) = (from.find('<'), from.find('>')) {
        if lt < from.len() && from.ends_with('>') {
            let name = from[..lt].trim().to_string();
            let email = from[lt + 1..from.len() - 1].trim().to_string();
            if !email.is_empty() {
                return (if name.is_empty() { "PreLife".into() } else { name }, email);
            }
        }
    }
    ("PreLife".to_string(), from.to_string())
}

/// POST /v3/smtp/email — one message through Brevo's relay.
async fn send_via_brevo(st: &St, msg: &MailMessage) -> bool {
    let (name, email) = brevo_sender(&st.cfg.mail_from);
    let body = json!({
        "sender": { "name": name, "email": email },
        "to": [{ "email": msg.to }],
        "subject": msg.subject,
        "htmlContent": msg.html,
    });
    match st
        .http
        .post("https://api.brevo.com/v3/smtp/email")
        .header("api-key", &st.cfg.brevo_api_key)
        .header("content-type", "application/json")
        .header("accept", "application/json")
        .body(serde_json::to_string(&body).unwrap_or_default())
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
    {
        Ok(res) => {
            if res.status().is_success() {
                true
            } else {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                eprintln!("[mail:brevo] {status} {text}");
                false
            }
        }
        Err(e) => {
            eprintln!("[mail:brevo] {e}");
            false
        }
    }
}

/// Send one message: Brevo, the outbox as the last resort. The sandbox
/// (SUPABASE_EMU=1) never talks to the real transports.
pub async fn send_mail(st: &St, msg: MailMessage) -> bool {
    if st.cfg.supabase_emu {
        let _ = st
            .supa
            .insert(
                "mail_outbox",
                &json!({
                    "to_email": msg.to,
                    "subject": msg.subject,
                    "html": msg.html,
                    "kind": msg.kind,
                }),
            )
            .await;
        println!("[mail:outbox] {} {}", msg.to, msg.subject);
        return false;
    }
    if !st.cfg.brevo_api_key.is_empty() && send_via_brevo(st, &msg).await {
        return true;
    }
    let _ = st
        .supa
        .insert(
            "mail_outbox",
            &json!({
                "to_email": msg.to,
                "subject": msg.subject,
                "html": msg.html,
                "kind": msg.kind,
            }),
        )
        .await;
    println!("[mail:outbox] {} {}", msg.to, msg.subject);
    false
}

/* ── The shared shell (globals.css palette) ────────────────────────────── */

const INK: &str = "#1d1d1f";
const ACCENT: &str = "#7b2d3b";
const MUTED: &str = "#6e6e73";
const TILE: &str = "#0b0b0d";
const WAND: &str = "#e0b45c";
const FONT: &str = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

fn esc(s: &str) -> String {
    escape_html(s)
}

fn brand_header() -> String {
    format!(
        r#"<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="42" height="42" valign="middle" style="width:42px;height:42px;background:{TILE};border-radius:12px;text-align:center;vertical-align:middle;">
      <span style="font-family:{FONT};font-size:20px;line-height:42px;color:{WAND};">&#10022;</span>
    </td>
    <td class="pl-ink" style="padding-left:12px;font-family:{FONT};font-size:17px;font-weight:700;line-height:42px;color:{INK};">
      Pre<span style="color:{ACCENT};font-style:italic;">Life</span><span style="color:{ACCENT};font-size:13px;">&nbsp;&#8226;</span>
    </td>
  </tr>
</table>"#
    )
}

fn cta_button(href: &str, label: &str) -> String {
    let safe = esc(href);
    format!(
        r#"<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 10px;">
  <tr>
    <td style="border-radius:999px;background:{ACCENT};">
      <a href="{safe}" style="display:inline-block;padding:14px 38px;border-radius:999px;background:{ACCENT};color:#ffffff;font-family:{FONT};font-size:15px;font-weight:600;text-decoration:none;">{label}</a>
    </td>
  </tr>
</table>"#
    )
}

fn link_fallback(href: &str) -> String {
    let safe = esc(href);
    format!(
        r#"<p class="pl-muted" style="margin:0 0 20px;font-family:{FONT};font-size:12px;line-height:1.6;color:{MUTED};word-break:break-all;text-align:center;">
  <a href="{safe}" style="color:{MUTED};text-decoration:underline;">{safe}</a>
</p>"#
    )
}

fn chip(html: &str) -> String {
    format!(
        r#"<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td class="pl-chip" style="background:#f5f5f7;border-radius:12px;padding:12px 16px;font-family:{FONT};font-size:12.5px;line-height:1.6;color:{MUTED};">{html}</td></tr>
</table>"#
    )
}

fn auto_note(lang: &str) -> &'static str {
    match lang {
        "en" => "This message was sent automatically — there is no need to reply.",
        "ru" => "Это сообщение отправлено автоматически — отвечать на него не нужно.",
        _ => "Bu mesaj avtomatik göndərilmişdir — buraya cavab yazmağa ehtiyac yoxdur.",
    }
}

fn mail_shell(lang: &str, subject: &str, content: &str, note: &str) -> String {
    format!(
        r#"<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{subject_esc}</title>
<style>
  body{{margin:0;padding:0;}}
  a{{text-decoration:none;}}
  @media (prefers-color-scheme: dark){{
    .pl-bg{{background:#0d0d0f !important;}}
    .pl-card{{background:#161618 !important;border-color:rgba(245,245,247,.12) !important;}}
    .pl-ink{{color:#f5f5f7 !important;}}
    .pl-muted{{color:#a1a1a6 !important;}}
    .pl-chip{{background:rgba(245,245,247,.06) !important;}}
    .pl-hr{{border-color:rgba(245,245,247,.12) !important;}}
  }}
</style>
</head>
<body class="pl-bg" style="margin:0;padding:36px 16px;background:#f5f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="pl-bg" style="background:#f5f5f7;">
<tr><td align="center">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="460" class="pl-card" style="width:460px;max-width:100%;background:#ffffff;border:1px solid rgba(29,29,31,.10);border-radius:22px;">
  <tr><td style="padding:30px 32px 0;">{brand}</td></tr>
  <tr><td style="padding:26px 32px 0;">{content}</td></tr>
  <tr><td style="padding:24px 32px 30px;">
    <hr class="pl-hr" style="border:none;border-top:1px solid rgba(29,29,31,.10);margin:0 0 14px;">
    <p class="pl-muted" style="margin:0;font-family:{FONT};font-size:12px;line-height:1.6;color:{MUTED};">{note}</p>
  </td></tr>
</table>

<p class="pl-muted" style="margin:14px 0 0;font-family:{FONT};font-size:11px;line-height:1.5;color:{MUTED};">PreLife &#8226; {auto_note}</p>

</td></tr>
</table>
</body>
</html>"#,
        lang = lang,
        subject_esc = esc(subject),
        brand = brand_header(),
        content = content,
        note = note,
        auto_note = auto_note(lang),
    )
}

/* ── Verification e-mail ───────────────────────────────────────────────── */

fn verification_strings(lang: &str) -> (&'static str, &'static str, &'static str, &'static str, &'static str, &'static str) {
    // (subject, heading, body, cta, validity, note)
    match lang {
        "en" => (
            "Confirm your account — PreLife",
            "Confirm your account",
            "This link is your first sign-in: open the button and your account is confirmed with you signed in automatically. On later visits, simply sign in with your e-mail and password.",
            "Confirm & sign in",
            "The link is valid for 1 week — if you do not confirm within that time, the registration is cancelled automatically.",
            "If you did not create this account, just ignore this e-mail — nothing will change.",
        ),
        "ru" => (
            "Подтвердите аккаунт — PreLife",
            "Подтвердите аккаунт",
            "Эта ссылка — ваш первый вход: откройте кнопку, аккаунт подтвердится, и вы войдёте автоматически. В дальнейшем входите как обычно — e-mail и пароль.",
            "Подтвердить и войти",
            "Ссылка действует 1 неделю — если за это время не подтвердить аккаунт, регистрация будет автоматически отменена.",
            "Если вы не создавали этот аккаунт, просто проигнорируйте это письмо — ничего не изменится.",
        ),
        _ => (
            "Hesabınızı təsdiqləyin — PreLife",
            "Hesabınızı təsdiqləyin",
            "Bu link ilk girişinizdir: düyməni açdıqda hesabınız təsdiqlənir və avtomatik daxil olursunuz. Sonrakı girişlərdə e-poçt və şifrənizlə normal daxil ola bilərsiniz.",
            "Təsdiqlə və daxil ol",
            "Link 1 həftə qüvvədədir — bu müddətdə hesabınızı təsdiqləməsəniz, qeydiyyat avtomatik ləğv olunacaq.",
            "Bu hesabı siz açmamısınızsa, bu e-poçtu nəzərə almayın — heç nə dəyişməyəcək.",
        ),
    }
}

pub fn verification_email_html(locale: &str, link: &str) -> (String, String) {
    let lang = norm_locale_str(locale);
    let (subject, heading, body, cta, validity, note) = verification_strings(lang);
    let content = format!(
        r#"  <h1 class="pl-ink" style="margin:0 0 12px;font-family:{FONT};font-size:22px;line-height:1.3;font-weight:700;color:{INK};">{heading}</h1>
  <p class="pl-muted" style="margin:0 0 26px;font-family:{FONT};font-size:15px;line-height:1.65;color:{MUTED};">{body}</p>
  {cta}
  {fallback}
  {validity}"#,
        cta = cta_button(link, cta),
        fallback = link_fallback(link),
        validity = chip(validity),
    );
    (subject.to_string(), mail_shell(lang, subject, &content, note))
}

/* ── Payment-due e-mail ────────────────────────────────────────────────── */

struct PaymentStrings {
    subject: &'static str,
    heading: &'static str,
    body: &'static str,
    cta: &'static str,
    footer: &'static str,
    psychologist: &'static str,
    when: &'static str,
    format: &'static str,
    price: &'static str,
    mode_online: &'static str,
    mode_office: &'static str,
}

fn payment_strings(lang: &str) -> PaymentStrings {
    match lang {
        "en" => PaymentStrings {
            subject: "Your session is confirmed — payment due",
            heading: "Your session is confirmed",
            body: "The psychologist accepted your request. Complete the payment to lock the time in — the session counts as booked once it is paid.",
            cta: "Go to payment",
            footer: "Until the payment is completed, the time slot may go to another client.",
            psychologist: "Psychologist",
            when: "Date and time (Baku)",
            format: "Format",
            price: "Price",
            mode_online: "Online",
            mode_office: "In-office",
        },
        "ru" => PaymentStrings {
            subject: "Ваш сеанс подтверждён — ожидается оплата",
            heading: "Ваш сеанс подтверждён",
            body: "Психолог принял вашу заявку. Завершите оплату, чтобы закрепить время — сеанс считается забронированным только после оплаты.",
            cta: "Перейти к оплате",
            footer: "Пока оплата не завершена, время может перейти к другому клиенту.",
            psychologist: "Психолог",
            when: "Дата и время (Баку)",
            format: "Формат",
            price: "Стоимость",
            mode_online: "Онлайн",
            mode_office: "Кабинет",
        },
        _ => PaymentStrings {
            subject: "Seansınız təsdiqləndi — ödəniş gözlənir",
            heading: "Seansınız təsdiqləndi",
            body: "Psixoloq sorğunuzu qəbul etdi. Vaxtınızı saxlamaq üçün ödənişi tamamlayın — ödənişdən sonra seans təsdiqlənmiş sayılır.",
            cta: "Ödənişə keç",
            footer: "Ödəniş tamamlanmayana qədər vaxt başqa müştəriyə keçə bilər.",
            psychologist: "Psixoloq",
            when: "Tarix və saat (Bakı)",
            format: "Format",
            price: "Qiymət",
            mode_online: "Onlayn",
            mode_office: "Kabinet",
        },
    }
}

pub struct PaymentDueInput<'a> {
    pub psychologist: &'a str,
    pub start_at_label: &'a str,
    pub mode: &'a str,
    pub price: Option<f64>,
    pub link: &'a str,
}

pub fn build_payment_due_mail(locale: &str, input: PaymentDueInput) -> (String, String) {
    let lang = norm_locale_str(locale);
    let s = payment_strings(lang);
    let detail = |label: &str, value: String| {
        format!(
            r#"    <tr>
      <td class="pl-muted" style="padding:7px 18px 7px 0;font-family:{FONT};font-size:13px;font-weight:600;color:{MUTED};white-space:nowrap;vertical-align:top;">{label}</td>
      <td class="pl-ink" style="padding:7px 0;font-family:{FONT};font-size:14px;font-weight:600;color:{INK};">{value}</td>
    </tr>"#
        )
    };
    let price = match input.price {
        None => "—".to_string(),
        Some(p) => format!("{} AZN", format_price(p)),
    };
    let content = format!(
        r#"  <h1 class="pl-ink" style="margin:0 0 12px;font-family:{FONT};font-size:22px;line-height:1.3;font-weight:700;color:{INK};">{heading}</h1>
  <p class="pl-muted" style="margin:0 0 20px;font-family:{FONT};font-size:15px;line-height:1.65;color:{MUTED};">{body}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-collapse:collapse;">
{d1}
{d2}
{d3}
{d4}
  </table>
  {cta}
  {fallback}"#,
        heading = s.heading,
        body = s.body,
        d1 = detail(s.psychologist, esc(input.psychologist)),
        d2 = detail(s.when, esc(input.start_at_label)),
        d3 = detail(s.format, if input.mode == "office" { s.mode_office.to_string() } else { s.mode_online.to_string() }),
        d4 = detail(s.price, price),
        cta = cta_button(input.link, s.cta),
        fallback = link_fallback(input.link),
    );
    (s.subject.to_string(), mail_shell(lang, s.subject, &content, s.footer))
}

/* ── Declined e-mail ───────────────────────────────────────────────────── */

pub fn build_request_declined_mail(locale: &str, psychologist: &str, start_at_label: &str) -> (String, String) {
    let lang = norm_locale_str(locale);
    let (subject, heading, body, footer) = match lang {
        "en" => (
            "Your session request was not confirmed",
            "Your request was not confirmed",
            "Unfortunately, the psychologist could not take this time. You are welcome to pick another slot from the schedule and send a new request.",
            "If you have any questions, feel free to reach out — PreLife.",
        ),
        "ru" => (
            "Ваша заявка на сеанс не подтверждена",
            "Ваша заявка не подтверждена",
            "К сожалению, психолог не смог принять это время. Вы можете выбрать другое время в расписании и отправить новую заявку.",
            "Если появятся вопросы — пишите нам, PreLife.",
        ),
        _ => (
            "Seans sorğunuz təsdiqlənmədi",
            "Sorğunuz təsdiqlənmədi",
            "Təəssüf ki, bu vaxt üçün sorğunuz qəbul edilmədi. Psixoloqun cədvəlindən başqa bir vaxt seçərək yenidən sorğu göndərə bilərsiniz.",
            "Sualınız olsa, bizimlə əlaqə saxlamaqdan çəkinməyin — PreLife.",
        ),
    };
    let content = format!(
        r#"  <h1 class="pl-ink" style="margin:0 0 12px;font-family:{FONT};font-size:22px;line-height:1.3;font-weight:700;color:{INK};">{heading}</h1>
  <p class="pl-muted" style="margin:0 0 20px;font-family:{FONT};font-size:15px;line-height:1.65;color:{MUTED};">{body}</p>
  {chip}"#,
        chip = chip(&format!(
            r#"<b class="pl-ink" style="color:{INK};">{}</b> &middot; {}"#,
            esc(psychologist),
            esc(start_at_label)
        )),
    );
    (subject.to_string(), mail_shell(lang, subject, &content, footer))
}

/* ── helpers ───────────────────────────────────────────────────────────── */

pub fn norm_locale_str(raw: &str) -> &str {
    match raw {
        "en" => "en",
        "ru" => "ru",
        _ => "az",
    }
}

/// JS-like number rendering for prices (12 → "12", 12.5 → "12.5").
pub fn format_price(v: f64) -> String {
    if (v - v.trunc()).abs() < f64::EPSILON {
        format!("{}", v as i64)
    } else {
        let s = format!("{v:.2}");
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

/// Unused import guard (Value used by send paths above via json!).
#[allow(dead_code)]
fn _v(_: Value) {}
