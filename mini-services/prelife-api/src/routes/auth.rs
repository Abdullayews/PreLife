//! The auth routes — ports of src/app/api/auth/* (the v4.3–v4.7
//! account-first decision trees, the OAuth PKCE dance, verification).

use super::{json_ok, json_status, read_json};
use crate::error::{ApiError, DomainError};
use crate::session::{self, gateway_url, origin_from, redirect_with_cookies};
use crate::state::St;
use crate::supa::Supa;
use crate::util::*;
use crate::verification as vf;
use axum::body::Bytes;
use axum::extract::{Path, RawQuery, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

fn is_secure(headers: &HeaderMap) -> bool {
    session::is_secure(headers)
}

/* ── POST /api/auth/login ─────────────────────────────────────────────── */

pub async fn login(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let body = read_json(&body);
    let email = match body.get("email") {
        Some(Value::String(e)) => e.trim().to_lowercase(),
        _ => String::new(),
    };
    let password = match body.get("password") {
        Some(Value::String(p)) => p.clone(),
        _ => String::new(),
    };
    let locale = match body.get("locale") {
        Some(Value::String(l)) => l.clone(),
        _ => "az".to_string(),
    };
    if email.is_empty() {
        return Err(err(400, "missing_fields"));
    }

    // v4.7 brute-force ceiling — both buckets checked together, so a
    // rejected request consumes neither.
    let ip = crate::state::AppState::client_ip(&headers);
    if !st.rate_allow_all(&[
        (format!("login:ip:{ip}"), 40, std::time::Duration::from_secs(15 * 60)),
        (format!("login:em:{email}"), 20, std::time::Duration::from_secs(15 * 60)),
    ]) {
        return Err(err(429, "too_many_requests"));
    }

    // Does an account exist for this e-mail?
    let account = st.supa.admin_find_user_by_email(&email).await;

    if let Some(acc) = account.as_ref() {
        let accv = Value::Object(acc.clone());
        let user_id = s(&accv, "id");
        let confirmed = Supa::is_confirmed_user(&accv);

        if !confirmed {
            let pending = vf::pending_verification_for_user(&st, &user_id).await;
            if !vf::verification_expired(pending.as_ref()) {
                return Err(err(403, "email_unverified"));
            }
            vf::purge_registration(&st, &user_id).await;
            // (fall through to the no-account path)
        } else {
            if password.is_empty() {
                return Err(err(401, "password_required"));
            }
            let granted = st.supa.password_login(&email, &password).await;
            let granted = match granted {
                Ok(g) => g,
                Err(e) => {
                    let msg = e.message();
                    if msg.contains("Email not confirmed") {
                        return Err(err(403, "email_unverified"));
                    }
                    if msg.contains("invalid_grant") || msg.contains("Invalid login credentials") {
                        // Completion step skipped: send a magic completion link.
                        let needs = accv.pointer("/user_metadata/needs_completion") == Some(&json!(true));
                        if needs {
                            if !st.mail_send_allowed(&ip, &email) {
                                return Err(err(429, "too_many_requests"));
                            }
                            let origin = origin_from(&st, &headers);
                            if let Ok((_t, dev_link)) =
                                vf::create_verification(&st, &user_id, &email, &locale, &origin).await
                            {
                                return Ok(json_ok(json!({
                                    "action": "check_inbox",
                                    "email": email,
                                    "devLink": dev_link,
                                })));
                            }
                        }
                        return Err(err(401, "invalid_credentials"));
                    }
                    eprintln!("[auth:login] {msg}");
                    return Err(err(500, "generic"));
                }
            };
            let Some((uid, uemail, uname)) = Supa::user_from_auth(granted.get("user").unwrap_or(&Value::Null)) else {
                return Err(err(500, "generic"));
            };
            let user = json!({ "id": uid, "email": uemail, "name": uname });
            let (token, session_user) = match session::create_session(&st, &user, headers.get("user-agent").and_then(|v| v.to_str().ok())).await {
                Ok(x) => x,
                Err(e) => {
                    eprintln!("[auth:login session] {e}");
                    return Err(err(500, "generic"));
                }
            };
            let mut res = json_ok(json!({ "user": session::user_view(&session_user) })).into_response();
            res.headers_mut().append(
                "set-cookie",
                session::session_cookie(&token, is_secure(&headers)).parse().unwrap(),
            );
            return Ok(res);
        }
    }

    // No account (never existed, or the pending one was just purged).
    if !password.is_empty() {
        return Ok(json_ok(json!({ "action": "signup_prefill", "email": email })));
    }

    // E-mail only: start the registration right here (v4.6).
    if !st.mail_send_allowed(&ip, &email) {
        return Err(err(429, "too_many_requests"));
    }
    let origin = origin_from(&st, &headers);
    match vf::start_mail_registration(&st, &email, &locale, &origin).await {
        Ok((_uid, dev_link)) => Ok(json_ok(json!({ "action": "check_inbox", "email": email, "devLink": dev_link }))),
        Err(e) => {
            let msg = e.message();
            if msg.contains("422") {
                return Err(err(403, "email_unverified"));
            }
            eprintln!("[auth:login register] {msg}");
            Err(err(500, "generic"))
        }
    }
}

/* ── POST /api/auth/signup ────────────────────────────────────────────── */

pub async fn signup(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let body = read_json(&body);
    let name = match body.get("name") {
        Some(Value::String(n)) => n.trim().to_string(),
        _ => String::new(),
    };
    let email = match body.get("email") {
        Some(Value::String(e)) => e.trim().to_lowercase(),
        _ => String::new(),
    };
    let password = match body.get("password") {
        Some(Value::String(p)) => p.clone(),
        _ => String::new(),
    };
    let locale = match body.get("locale") {
        Some(Value::String(l)) => l.clone(),
        _ => "az".to_string(),
    };

    if name.is_empty() || email.is_empty() || password.is_empty() {
        return Err(err(400, "missing_fields"));
    }
    if char_len(&name) < 2 || char_len(&name) > 100 {
        return Err(err(400, "missing_fields"));
    }
    // The email shape check.
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    let email_ok = parts.len() == 2
        && !parts[0].is_empty()
        && !parts[1].is_empty()
        && !parts[0].contains(char::is_whitespace)
        && !parts[1].contains(char::is_whitespace)
        && parts[1].contains('.')
        && parts[1].split('.').all(|seg| !seg.is_empty());
    if !email_ok {
        return Err(err(400, "invalid_email"));
    }
    if char_len(&password) < 8 {
        return Err(err(400, "short_password"));
    }

    let lang = match locale.as_str() {
        "en" => "en".to_string(),
        "ru" => "ru".to_string(),
        _ => "az".to_string(),
    };
    let origin = origin_from(&st, &headers);

    if !st.mail_send_allowed(&crate::state::AppState::client_ip(&headers), &email) {
        return Err(err(429, "too_many_requests"));
    }

    // Fresh create.
    let created = match st.supa.admin_create_user(&email, &password, &name, false, &json!({})).await {
        Ok(c) => c,
        Err(e) => {
            let msg = e.message();
            if msg.contains("422") {
                // Taken — by a pending registration or a real account?
                let existing = st.supa.admin_find_user_by_email(&email).await;
                let Some(existing) = existing else {
                    return Err(err(409, "email_taken"));
                };
                if existing.get("id").and_then(|i| i.as_str()).is_none() {
                    return Err(err(409, "email_taken"));
                }
                if Supa::is_confirmed_user(&Value::Object(existing.clone())) {
                    return Err(err(409, "email_taken"));
                }
                let existing_id = s(&Value::Object(existing.clone()), "id");
                let pending = vf::pending_verification_for_user(&st, &existing_id).await;
                if vf::verification_expired(pending.as_ref()) {
                    // The old registration lapsed — cancel and start clean.
                    vf::purge_registration(&st, &existing_id).await;
                    match st.supa.admin_create_user(&email, &password, &name, false, &json!({})).await {
                        Ok(c) => c,
                        Err(e2) => {
                            eprintln!("[auth:signup retry] {e2}");
                            return Err(err(500, "generic"));
                        }
                    }
                } else {
                    // Adopt the pending user. v5.2 (loop iter 3): security —
                    // the password and display name are NOT written before
                    // the e-mail link proves ownership. The old behaviour
                    // (overwriting the password with whatever the current
                    // caller chose) let anyone take over a pending account:
                    // the victim clicks the fresh link → the account is
                    // confirmed with a password only the attacker knows.
                    // Now a fresh verification mail is simply sent; if the
                    // account still needs completion the owner sets name +
                    // password on /complete after the link. Only the
                    // language preference carries over (harmless).
                    let id = existing_id;
                    if lang != "en" {
                        let _ = st
                            .supa
                            .update("profiles", &vec![("id".into(), format!("eq.{id}"))], &json!({ "lang": lang }))
                            .await;
                    }
                    match vf::create_verification(&st, &id, &email, &locale, &origin).await {
                        Ok((_t, dev_link)) => {
                            return Ok(json_status(json!({ "ok": true, "email": email, "devLink": dev_link }), StatusCode::CREATED));
                        }
                        Err(e2) => {
                            eprintln!("[auth:signup verification] {e2}");
                            return Err(err(500, "generic"));
                        }
                    }
                }
            } else if msg.contains("gotrue 400") {
                return Err(err(400, "invalid_email"));
            } else {
                eprintln!("[auth:signup] {msg}");
                return Err(err(500, "generic"));
            }
        }
    };

    let Some((user_id, _e, _n)) = Supa::user_from_auth(&created) else {
        return Err(err(500, "generic"));
    };

    if lang != "en" {
        let _ = st
            .supa
            .update("profiles", &vec![("id".into(), format!("eq.{user_id}"))], &json!({ "lang": lang }))
            .await;
    }

    match vf::create_verification(&st, &user_id, &email, &locale, &origin).await {
        Ok((_t, dev_link)) => Ok(json_status(json!({ "ok": true, "email": email, "devLink": dev_link }), StatusCode::CREATED)),
        Err(e) => {
            eprintln!("[auth:signup verification] {e}");
            Err(err(500, "generic"))
        }
    }
}

/* ── POST /api/auth/resend ────────────────────────────────────────────── */

pub async fn resend(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let body = read_json(&body);
    let email = match body.get("email") {
        Some(Value::String(e)) => e.trim().to_lowercase(),
        _ => String::new(),
    };
    let locale = match body.get("locale") {
        Some(Value::String(l)) => l.clone(),
        _ => "az".to_string(),
    };
    if email.is_empty() {
        return Err(err(400, "missing_fields"));
    }

    if !st.mail_send_allowed(&crate::state::AppState::client_ip(&headers), &email) {
        return Err(err(429, "too_many_requests"));
    }

    let pending = st
        .supa
        .select_one(
            "email_verifications",
            &vec![
                ("email".into(), format!("eq.{email}")),
                ("consumed_at".into(), "is.null".into()),
                ("expires_at".into(), format!("gt.{}", now_iso())),
                ("order".into(), "created_at.desc".into()),
            ],
        )
        .await
        .map_err(|e| {
            eprintln!("[auth:resend lookup] {e}");
            err(500, "generic")
        })?;

    let user_id = pending
        .as_ref()
        .map(|p| s(&Value::Object(p.clone()), "user_id"))
        .unwrap_or_default();
    if user_id.is_empty() {
        return Err(err(404, "unknown"));
    }

    let origin = origin_from(&st, &headers);
    match vf::create_verification(&st, &user_id, &email, &locale, &origin).await {
        Ok((_t, dev_link)) => Ok(json_ok(json!({ "ok": true, "devLink": dev_link }))),
        Err(e) => {
            eprintln!("[auth:resend] {e}");
            Err(err(500, "generic"))
        }
    }
}

/* ── POST /api/auth/logout ────────────────────────────────────────────── */

pub async fn logout(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    let cookies = parse_cookies(headers.get("cookie").and_then(|v| v.to_str().ok()));
    if let Some(token) = cookie_get(&cookies, session::SESSION_COOKIE) {
        session::revoke_token_session(&st, token).await;
    }
    let mut res = json_ok(json!({ "ok": true })).into_response();
    res.headers_mut()
        .append("set-cookie", session::cleared_session_cookie(is_secure(&headers)).parse().unwrap());
    Ok(res)
}

/* ── POST /api/auth/complete ──────────────────────────────────────────── */

pub async fn complete(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;

    let body = read_json(&body);
    let name = match body.get("name") {
        Some(Value::String(n)) => n.trim().to_string(),
        _ => String::new(),
    };
    let password = match body.get("password") {
        Some(Value::String(p)) => p.clone(),
        _ => String::new(),
    };

    if char_len(&name) < 2 || char_len(&name) > 100 {
        return Err(err(400, "missing_fields"));
    }
    if char_len(&password) < 8 {
        return Err(err(400, "short_password"));
    }

    let user_id = s(&cs.user, "id");
    st.supa
        .admin_update_user(&user_id, &json!({ "password": password, "user_metadata": { "full_name": name, "needs_completion": false } }))
        .await
        .map_err(|e| {
            eprintln!("[auth:complete user] {e}");
            err(500, "generic")
        })?;

    let _ = st
        .supa
        .update("profiles", &vec![("id".into(), format!("eq.{user_id}"))], &json!({ "full_name": name }))
        .await;
    st.session_cache_drop_user(&user_id);
    let _ = st
        .supa
        .update("sessions", &vec![("user_id".into(), format!("eq.{user_id}"))], &json!({ "user_name": name }))
        .await;

    Ok(json_ok(json!({ "ok": true })))
}

/* ── GET /api/auth/me ─────────────────────────────────────────────────── */

pub async fn me(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers).await;
    Ok(json_ok(json!({ "user": cs.map(|c| session::user_view(&c.user)) })))
}

/* ── GET /api/auth/verify ─────────────────────────────────────────────── */

pub async fn verify(State(st): State<St>, headers: HeaderMap, RawQuery(raw): RawQuery) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let q = parse_query(raw.as_deref());
    let token = query_get(&q, "token").unwrap_or("").to_string();
    let locale = vf::norm_locale(query_get(&q, "locale"));
    let origin = origin_from(&st, &headers);
    let secure = is_secure(&headers);

    let bounce = |path: String| -> Response {
        redirect_with_cookies(&format!("{origin}{path}"), StatusCode::SEE_OTHER, &[])
    };

    if token.is_empty() {
        return Ok(bounce(format!("/{locale}/verify?status=invalid")));
    }

    let result = match vf::consume_verification(&st, &token).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[auth:verify] {e}");
            return Ok(bounce(format!("/{locale}/verify?status=invalid")));
        }
    };

    let (user_id, email) = match result {
        vf::ConsumeResult::Invalid => return Ok(bounce(format!("/{locale}/verify?status=invalid"))),
        vf::ConsumeResult::Expired { user_id, email } => {
            vf::purge_registration(&st, &user_id).await;
            return Ok(bounce(format!(
                "/{locale}/verify?status=expired&email={}",
                uri_encode(&email)
            )));
        }
        vf::ConsumeResult::Ok { user_id, email, locale: _ } => (user_id, email),
    };

    if let Err(e) = st.supa.admin_update_user(&user_id, &json!({ "email_confirm": true })).await {
        eprintln!("[auth:verify confirm] {e}");
        return Ok(bounce(format!("/{locale}/verify?status=invalid")));
    }

    // Accounts started from the login page hold a random password.
    let mut needs_completion = false;
    if let Ok(full) = st.supa.admin_get_user(&user_id).await {
        needs_completion = full.pointer("/user_metadata/needs_completion") == Some(&json!(true));
    }

    let name = st
        .supa
        .select_one("profiles", &vec![("select".into(), "full_name".into()), ("id".into(), format!("eq.{user_id}"))])
        .await
        .ok()
        .flatten()
        .and_then(|p| s_opt(&Value::Object(p), "full_name"));

    let user = json!({ "id": user_id, "email": email, "name": name });
    match session::create_session(&st, &user, headers.get("user-agent").and_then(|v| v.to_str().ok())).await {
        Ok((token, _)) => {
            let complete = if needs_completion { "&complete=1" } else { "" };
            let res = redirect_with_cookies(
                &format!("{origin}/{locale}/verify?status=ok{complete}"),
                StatusCode::SEE_OTHER,
                &[session::session_cookie(&token, secure)],
            );
            Ok(res)
        }
        Err(e) => {
            eprintln!("[auth:verify session] {e}");
            Ok(bounce(format!("/{locale}/verify?status=invalid")))
        }
    }
}

/* ── GET /api/auth/callback ───────────────────────────────────────────── */

const OAUTH_NEW_WINDOW_MS: i64 = 5 * 60 * 1000;
const OAUTH_SKEW_MS: i64 = 15 * 1000;

fn fail(st: &St, headers: &HeaderMap) -> Response {
    let origin = origin_from(st, headers);
    redirect_with_cookies(
        &format!("{origin}/login?error=oauth"),
        StatusCode::FOUND,
        &[session::cleared_oauth_cookie(session::is_secure(headers))],
    )
}

pub async fn callback(
    State(st): State<St>,
    headers: HeaderMap,
    RawQuery(raw): RawQuery,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Ok(fail(&st, &headers));
    }
    let q = parse_query(raw.as_deref());
    let code = query_get(&q, "code").unwrap_or("").to_string();
    if code.is_empty() || query_get(&q, "error").is_some() {
        return Ok(fail(&st, &headers));
    }
    let cookies = parse_cookies(headers.get("cookie").and_then(|v| v.to_str().ok()));
    let parsed = session::parse_oauth_cookie(&cookies);
    let Some(verifier) = parsed.verifier else {
        return Ok(fail(&st, &headers));
    };

    let secure = session::is_secure(&headers);

    // The PKCE exchange: through the in-process emu code map or GoTrue.
    let exchanged = if st.cfg.supabase_emu {
        crate::routes::emu::pkce_exchange(&st, &code, &verifier).await
    } else {
        st.supa.pkce_exchange(&code, &verifier).await.map_err(DomainError::from_supa)
    };
    let exchanged = match exchanged {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[auth:callback] {e}");
            return Ok(fail(&st, &headers));
        }
    };
    let raw = exchanged.get("user").cloned().unwrap_or(Value::Null);
    let Some((user_id, user_email, user_name)) = Supa::user_from_auth(&raw) else {
        return Ok(fail(&st, &headers));
    };

    let origin = origin_from(&st, &headers);
    let user = json!({ "id": user_id, "email": user_email, "name": user_name });

    // Brand-new OAuth-only row?
    let app_meta = raw.get("app_metadata").cloned().unwrap_or(json!({}));
    let providers: Vec<String> = app_meta
        .get("providers")
        .and_then(|p| p.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let created_ms = raw
        .get("created_at")
        .and_then(|c| c.as_str())
        .and_then(parse_iso_ms);
    let fresh = match created_ms {
        Some(created) if parsed.minted > 0 => created >= parsed.minted - OAUTH_SKEW_MS,
        Some(created) => now_ms() - created < OAUTH_NEW_WINDOW_MS,
        None => false,
    };
    if fresh && !providers.iter().any(|p| p == "email") {
        if parsed.mode == "signup" {
            if parsed.locale != "en" {
                let _ = st
                    .supa
                    .update("profiles", &vec![("id".into(), format!("eq.{user_id}"))], &json!({ "lang": parsed.locale }))
                    .await;
            }
            let (token, _) = session::create_session(&st, &user, headers.get("user-agent").and_then(|v| v.to_str().ok()))
                .await
                .map_err(|e| {
                    eprintln!("[auth:callback session] {e}");
                    e
                })?;
            return Ok(redirect_with_cookies(
                &format!("{origin}/home"),
                StatusCode::FOUND,
                &[session::session_cookie(&token, secure), session::cleared_oauth_cookie(secure)],
            ));
        }

        // Login rules (v4.6): the hand-off is AUTOMATIC.
        if let Err(e) = st.supa.admin_delete_user(&user_id).await {
            eprintln!("[auth:callback] phantom delete failed {e}");
        }
        match vf::start_mail_registration(&st, &user_email, &parsed.locale, &origin).await {
            Ok((_uid, dev_link)) => {
                let mut qs_pairs = vec![("email".to_string(), user_email.clone()), ("notice".to_string(), "mail_sent".into())];
                let mut qs = build_query(&qs_pairs);
                if let Some(dl) = dev_link {
                    qs_pairs.push(("devlink".into(), dl));
                    qs = build_query(&qs_pairs);
                }
                return Ok(redirect_with_cookies(
                    &format!("{origin}/{}/login?{qs}", parsed.locale),
                    StatusCode::FOUND,
                    &[session::cleared_oauth_cookie(secure)],
                ));
            }
            Err(e) => {
                eprintln!("[auth:callback mail hand-off] {e}");
                return Ok(redirect_with_cookies(
                    &format!(
                        "{origin}/{}/login?email={}&notice=oauth_new",
                        parsed.locale,
                        uri_encode(&user_email)
                    ),
                    StatusCode::FOUND,
                    &[session::cleared_oauth_cookie(secure)],
                ));
            }
        }
    }

    // An e-mail account behind the provider button must be CONFIRMED.
    if providers.iter().any(|p| p == "email") {
        let account = st.supa.admin_find_user_by_email(&user_email).await;
        let confirmed = match account {
            Some(acc) => Supa::is_confirmed_user(&Value::Object(acc)),
            None => Supa::is_confirmed_user(&raw),
        };
        if !confirmed {
            return Ok(redirect_with_cookies(
                &format!(
                    "{origin}/{}/login?email={}&notice=unconfirmed",
                    parsed.locale,
                    uri_encode(&user_email)
                ),
                StatusCode::FOUND,
                &[session::cleared_oauth_cookie(secure)],
            ));
        }
    }

    let (token, _) = session::create_session(&st, &user, headers.get("user-agent").and_then(|v| v.to_str().ok()))
        .await
        .map_err(|e| {
            eprintln!("[auth:callback session] {e}");
            e
        })?;
    Ok(redirect_with_cookies(
        &format!("{origin}/home"),
        StatusCode::FOUND,
        &[session::session_cookie(&token, secure), session::cleared_oauth_cookie(secure)],
    ))
}

/* ── GET /api/auth/oauth/{provider} ───────────────────────────────────── */

pub async fn oauth_start(
    State(st): State<St>,
    Path(provider): Path<String>,
    headers: HeaderMap,
    RawQuery(raw): RawQuery,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    if provider != "google" && provider != "apple" {
        return Err(err(404, "unknown_provider"));
    }

    let origin = origin_from(&st, &headers);
    let redirect_to = gateway_url(&st, &format!("{origin}/api/auth/callback"));
    let q = parse_query(raw.as_deref());
    let locale_raw = query_get(&q, "locale").unwrap_or("az");
    let locale = if locale_raw == "en" || locale_raw == "ru" { locale_raw.to_string() } else { "az".to_string() };
    let mode = if query_get(&q, "mode") == Some("signup") { "signup" } else { "login" };

    let verifier = random_token(48); // 64 chars — inside 43..128
    let challenge = sha256_b64url(&verifier);

    let authorize_base = st.cfg.browser_auth_base(&origin);
    let url = format!(
        "{authorize_base}/authorize?provider={provider}&redirect_to={}&code_challenge={challenge}&code_challenge_method=S256",
        uri_encode(&redirect_to)
    );
    // Browser-facing /api/* navigation — the sandbox gateway routes it.
    let url = gateway_url(&st, &url);

    let secure = is_secure(&headers);
    Ok(redirect_with_cookies(
        &url,
        StatusCode::FOUND,
        &[session::oauth_cookie(&verifier, secure, &locale, mode)],
    ))
}
