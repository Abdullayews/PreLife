//! E-mail verification tokens — the port of lib/server/verification.ts.
//! Only the sha256 hash of a token is stored; the 1-week window, the
//! atomic single-use claim and the v4.6 shared mail-registration start.

use crate::error::DomainError;
use crate::mail::{send_mail, verification_email_html};
use crate::session::gateway_url;
use crate::state::St;
use crate::util::*;
use serde_json::{json, Value};

const VERIFICATION_TTL_MS: i64 = 7 * 24 * 60 * 60 * 1000; // 1 week

/// Normalize to the three site locales (anything else falls back to az).
pub fn norm_locale(raw: Option<&str>) -> String {
    match raw {
        Some("en") => "en".into(),
        Some("ru") => "ru".into(),
        _ => "az".into(),
    }
}

fn as_value(row: Row) -> Value {
    Value::Object(row)
}

/// Mint a fresh verification token for the user and send the e-mail.
/// Deletes the user's previous tokens first. Returns (token, devLink).
pub async fn create_verification(
    st: &St,
    user_id: &str,
    email: &str,
    locale: &str,
    origin: &str,
) -> Result<(String, Option<String>), DomainError> {
    let loc = norm_locale(Some(locale));
    let token = random_token(32);
    let token_hash = sha256_hex(&token);

    st.supa
        .delete("email_verifications", &vec![("user_id".into(), format!("eq.{user_id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    st.supa
        .insert(
            "email_verifications",
            &json!({
                "user_id": user_id,
                "email": email,
                "token_hash": token_hash,
                "locale": loc,
                "expires_at": ms_to_iso(now_ms() + VERIFICATION_TTL_MS),
                "consumed_at": null,
            }),
        )
        .await
        .map_err(DomainError::from_supa)?;

    let link = format!("{origin}/api/auth/verify?token={}&locale={loc}", uri_encode(&token));
    // The sandbox gateway routes /api/* to this service by query param.
    let link = gateway_url(st, &link);
    let (subject, html) = verification_email_html(&loc, &link);
    let sent = send_mail(
        st,
        crate::mail::MailMessage { to: email.to_string(), subject, html, kind: "email_verification".into() },
    )
    .await;

    let dev_link = if !sent && st.cfg.dev() { Some(link) } else { None };
    Ok((token, dev_link))
}

pub enum ConsumeResult {
    Ok { user_id: String, email: String, locale: String },
    Expired { user_id: String, email: String },
    Invalid,
}

/// Redeem a verification token (missing/used → Invalid, past the window →
/// Expired, else atomically claim and return).
pub async fn consume_verification(st: &St, token: &str) -> Result<ConsumeResult, DomainError> {
    let hash = sha256_hex(token);
    let row = st
        .supa
        .select_one("email_verifications", &vec![("token_hash".into(), format!("eq.{hash}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(row) = row else { return Ok(ConsumeResult::Invalid) };
    let v = as_value(row);

    let user_id = s_opt(&v, "user_id").unwrap_or_default();
    let email = s_opt(&v, "email").unwrap_or_default();
    if v.get("consumed_at").map(|c| !c.is_null()).unwrap_or(false) {
        return Ok(ConsumeResult::Invalid);
    }
    if user_id.is_empty() || email.is_empty() {
        return Ok(ConsumeResult::Invalid);
    }

    let expires_at = s_opt(&v, "expires_at").and_then(|t| parse_iso_ms(&t));
    let expired = match expires_at {
        Some(t) => t <= now_ms(),
        None => true,
    };
    if expired {
        return Ok(ConsumeResult::Expired { user_id, email });
    }

    // Atomic single-use claim (v4.7): the UPDATE itself carries the
    // "still unconsumed" filter.
    let claimed = st
        .supa
        .update(
            "email_verifications",
            &vec![("token_hash".into(), format!("eq.{hash}")), ("consumed_at".into(), "is.null".into())],
            &json!({ "consumed_at": now_iso() }),
        )
        .await
        .unwrap_or_default();
    if claimed.is_empty() {
        return Ok(ConsumeResult::Invalid);
    }
    Ok(ConsumeResult::Ok { user_id, email, locale: norm_locale(s_opt(&v, "locale").as_deref()) })
}

/// v4.6: the shared "start a mail registration" step — creates the
/// pending account (random placeholder password, unconfirmed,
/// needs_completion) and sends the 1-week verification e-mail. Throws
/// whatever GoTrue throws (the message carries the 422).
pub async fn start_mail_registration(
    st: &St,
    email: &str,
    locale: &str,
    origin: &str,
) -> Result<(String, Option<String>), DomainError> {
    let created = st
        .supa
        .admin_create_user(email, &random_token(24), "", false, &json!({ "needs_completion": true }))
        .await
        .map_err(DomainError::from_supa)?;
    let Some((user_id, _email, _name)) = crate::supa::Supa::user_from_auth(&created) else {
        return Err(DomainError::msg("unexpected user shape after create"));
    };

    let lang = norm_locale(Some(locale));
    if lang != "en" {
        let _ = st
            .supa
            .update("profiles", &vec![("id".into(), format!("eq.{user_id}"))], &json!({ "lang": lang }))
            .await;
    }

    let (_token, dev_link) = create_verification(st, &user_id, email, locale, origin).await?;
    Ok((user_id, dev_link))
}

/// The latest unconsumed verification row of a user (any expiry).
pub async fn pending_verification_for_user(st: &St, user_id: &str) -> Option<Value> {
    st.supa
        .select_one(
            "email_verifications",
            &vec![
                ("user_id".into(), format!("eq.{user_id}")),
                ("consumed_at".into(), "is.null".into()),
                ("order".into(), "created_at.desc".into()),
            ],
        )
        .await
        .ok()
        .flatten()
        .map(as_value)
}

/// True when the verification row is missing or past its 1-week window.
pub fn verification_expired(row: Option<&Value>) -> bool {
    let Some(v) = row else { return true };
    match s_opt(v, "expires_at").and_then(|t| parse_iso_ms(&t)) {
        Some(t) => t <= now_ms(),
        None => true,
    }
}

/// Cancel a registration that was never confirmed in its 1-week window.
pub async fn purge_registration(st: &St, user_id: &str) {
    let _ = st
        .supa
        .delete("email_verifications", &vec![("user_id".into(), format!("eq.{user_id}"))])
        .await;
    if let Err(e) = st.supa.admin_delete_user(user_id).await {
        eprintln!("[verification:purge] {e}");
    }
}
