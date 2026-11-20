//! The local Supabase emulator's HTTP surface — /api/supa-emu/* (DEV
//! only, SUPABASE_EMU=1). The REST routes mirror PostgREST; the auth
//! routes mirror GoTrue, including the provider consent page that
//! replaces Google/Apple's window in the sandbox.

use crate::error::DomainError;
use crate::session::gateway_url;
use crate::state::{OAuthCode, St};
use crate::util::*;
use axum::body::Bytes;
use axum::extract::{Path, RawQuery, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};

const OAUTH_CODE_TTL_MS: i64 = 10 * 60 * 1000;

fn emu_identities(provider: &str) -> (&'static str, &'static str) {
    match provider {
        "google" => ("google.user@emu.prelife.dev", "Google User"),
        "apple" => ("apple.user@emu.prelife.dev", "Apple User"),
        _ => ("", "OAuth User"),
    }
}

fn emu_guard(st: &St) -> Option<Response> {
    if st.cfg.supabase_emu {
        None
    } else {
        Some((StatusCode::NOT_FOUND, Json(json!({ "message": "not found" }))).into_response())
    }
}

/* ── REST: /api/supa-emu/rest/v1/{table} ──────────────────────────────── */

pub async fn rest_get(
    State(st): State<St>,
    Path(table): Path<String>,
    RawQuery(raw): RawQuery,
) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let Some(store) = st.emu.clone() else { return not_found_json() };
    let q = parse_query(raw.as_deref());
    let rows: Vec<Value> = store.rest_get(&table, &q).into_iter().map(Value::Object).collect();
    Json(rows).into_response()
}

pub async fn rest_post(State(st): State<St>, Path(table): Path<String>, body: Bytes) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let Some(store) = st.emu.clone() else { return not_found_json() };
    let body: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid json" }))).into_response(),
    };
    match store.rest_post(&table, &body) {
        Some(created) => {
            let rows: Vec<Value> = created.into_iter().map(Value::Object).collect();
            (StatusCode::CREATED, Json(rows)).into_response()
        }
        None => (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid body" }))).into_response(),
    }
}

pub async fn rest_patch(State(st): State<St>, Path(table): Path<String>, RawQuery(raw): RawQuery, body: Bytes) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let Some(store) = st.emu.clone() else { return not_found_json() };
    let body: Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid json" }))).into_response(),
    };
    let Some(obj) = body.as_object().cloned() else {
        return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid body" }))).into_response();
    };
    let q = parse_query(raw.as_deref());
    let rows: Vec<Value> = store.rest_patch(&table, &obj, &q).into_iter().map(Value::Object).collect();
    Json(rows).into_response()
}

pub async fn rest_delete(State(st): State<St>, Path(table): Path<String>, RawQuery(raw): RawQuery) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let Some(store) = st.emu.clone() else { return not_found_json() };
    let q = parse_query(raw.as_deref());
    store.rest_delete(&table, &q);
    StatusCode::NO_CONTENT.into_response()
}

fn not_found_json() -> Response {
    (StatusCode::NOT_FOUND, Json(json!({ "message": "not found" }))).into_response()
}

/* ── OAuth codes (the in-memory dance state) ──────────────────────────── */

fn issue_oauth_code(st: &St, challenge: &str, user_id: &str) -> String {
    let now = now_ms();
    st.oauth_codes.lock().unwrap().retain(|_, v| v.expires > now);
    let code = format!("emu-oauth-{}", uuid_v4());
    st.oauth_codes.lock().unwrap().insert(
        code.clone(),
        OAuthCode { challenge: challenge.to_string(), user_id: user_id.to_string(), expires: now + OAUTH_CODE_TTL_MS },
    );
    code
}

/// The PKCE exchange the callback route performs against the emu.
pub async fn pkce_exchange(st: &St, auth_code: &str, verifier: &str) -> Result<Value, DomainError> {
    let entry = st.oauth_codes.lock().unwrap().get(auth_code).cloned();
    let Some(entry) = entry else {
        st.oauth_codes.lock().unwrap().remove(auth_code);
        return Err(DomainError::msg("gotrue 400: {\"error\":\"invalid_grant\",\"error_description\":\"Invalid auth code\"}"));
    };
    if entry.expires <= now_ms() {
        st.oauth_codes.lock().unwrap().remove(auth_code);
        return Err(DomainError::msg("gotrue 400: {\"error\":\"invalid_grant\",\"error_description\":\"Invalid auth code\"}"));
    }
    if verifier.is_empty() || sha256_b64url(verifier) != entry.challenge {
        return Err(DomainError::msg("gotrue 400: {\"error\":\"invalid_grant\",\"error_description\":\"Invalid code_verifier\"}"));
    }
    st.oauth_codes.lock().unwrap().remove(auth_code); // single use

    let Some(store) = st.emu.clone() else {
        return Err(DomainError::msg("gotrue 400: {\"error\":\"invalid_grant\",\"error_description\":\"User not found\"}"));
    };
    let Some(user) = store.admin_get_user(&entry.user_id) else {
        return Err(DomainError::msg("gotrue 400: {\"error\":\"invalid_grant\",\"error_description\":\"User not found\"}"));
    };
    // Touch last_sign_in_at.
    let _ = store.admin_update_user(&entry.user_id, &json!({}));
    Ok(json!({
        "access_token": format!("emu-{}", uuid_v4()),
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": format!("emu-refresh-{}", uuid_v4()),
        "user": user,
    }))
}

/* ── The consent page ─────────────────────────────────────────────────── */

fn consent_page(st: &St, origin: &str, provider: &str, redirect_to: &str, challenge: &str, method: &str) -> Response {
    let identity = emu_identities(provider);
    let title = if provider == "apple" { "Apple" } else { "Google" };
    let action = gateway_url(st, &format!("{origin}/api/supa-emu/auth/v1/authorize"));
    // Every query-derived value is HTML-escaped: the authorize GET only
    // validates redirect_to's shape, so raw interpolation here would let a
    // crafted link inject attributes/script into the consent page (XSS).
    let html = format!(
        r#"<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} hesabı — emulyator</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #f4f2ee; color: #1f1d1a; padding: 24px;
  }}
  .card {{
    width: min(400px, 100%); background: #fff; border: 1px solid #e4e0d8;
    border-radius: 16px; padding: 28px; box-shadow: 0 12px 40px rgba(31,29,26,.08);
  }}
  .brand {{ margin: 0 0 6px; font-weight: 700; font-size: 18px; letter-spacing: .2px; }}
  .brand em {{ font-style: normal; color: #b08d2f; }}
  .tag {{ margin: 0 0 18px; font-size: 12px; color: #8a857c; text-transform: uppercase; letter-spacing: .8px; }}
  h1 {{ margin: 0 0 8px; font-size: 21px; }}
  p.note {{ margin: 0 0 20px; font-size: 13.5px; color: #6f6a61; }}
  label {{ display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; }}
  input[type=email] {{
    width: 100%; padding: 11px 12px; border: 1px solid #d8d3c9; border-radius: 10px;
    font-size: 15px; background: #fbfaf8; color: inherit;
  }}
  input[type=email]:focus {{ outline: 2px solid #b08d2f; outline-offset: -1px; }}
  button {{
    margin-top: 18px; width: 100%; padding: 12px 16px; border: 0; border-radius: 10px;
    background: #1f1d1a; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  }}
  button:hover {{ background: #38342e; }}
  .hint {{ margin: 14px 0 0; font-size: 12.5px; color: #8a857c; }}
</style>
</head>
<body>
<main class="card">
  <p class="brand">Pre<em>Life</em></p>
  <p class="tag">Sandbox emulyatoru</p>
  <h1>{title} hesabı ilə davam edin</h1>
  <p class="note">Bu səhifə yalnız sınaq rejimində görünür — real {title} pəncərəsinin yerini tutur. Mövcud hesabın e-poçtunu yazsanız, provayder ona bağlanacaq.</p>
  <form method="post" action="{action}">
    <input type="hidden" name="provider" value="{provider_esc}">
    <input type="hidden" name="redirect_to" value="{redirect_esc}">
    <input type="hidden" name="code_challenge" value="{challenge_esc}">
    <input type="hidden" name="code_challenge_method" value="{method_esc}">
    <label for="email">{title} e-poçtu</label>
    <input id="email" name="email" type="email" value="{identity_email}" required autocomplete="off">
    <button type="submit">Davam et</button>
    <p class="hint">Qeydiyyatda basanda hesab dərhal yaranır; girişdə basanda e-poçt yoxdursa mail axınına keçirsiniz.</p>
  </form>
</main>
</body>
</html>"#,
        identity_email = escape_html(identity.0),
        provider_esc = escape_html(provider),
        redirect_esc = escape_html(redirect_to),
        challenge_esc = escape_html(challenge),
        method_esc = escape_html(method),
    );
    (
        [(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")],
        html,
    )
        .into_response()
}

/* ── AUTH: /api/supa-emu/auth/v1/{*action} ────────────────────────────── */

fn action_parts(action: &str) -> Vec<String> {
    action.split('/').map(|s| urldecode(s)).collect()
}

fn urldecode(s: &str) -> String {
    uri_decode(s)
}

pub async fn auth_get(State(st): State<St>, Path(action): Path<String>, RawQuery(raw): RawQuery, headers: HeaderMap) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let parts = action_parts(&action);
    let q = parse_query(raw.as_deref());
    let origin = crate::session::origin_from(&st, &headers);

    // GET /admin/users?emails=… — the exact-match e-mail lookup.
    if parts.len() == 2 && parts[0] == "admin" && parts[1] == "users" {
        let Some(store) = st.emu.clone() else { return not_found_json() };
        let emails: Vec<String> = q
            .iter()
            .filter(|(k, _)| k == "emails")
            .flat_map(|(_, v)| v.split(',').map(|s| s.trim().to_lowercase()).collect::<Vec<_>>())
            .filter(|s| !s.is_empty())
            .collect();
        let filter = query_get(&q, "filter").unwrap_or("").trim().to_lowercase();

        let mut users = store.admin_list_users(&emails, &filter);
        let per_page = query_get(&q, "per_page").and_then(|v| v.parse::<usize>().ok()).unwrap_or(10).clamp(1, 50);
        let page = query_get(&q, "page").and_then(|v| v.parse::<usize>().ok()).unwrap_or(1).max(1);
        let start = (page - 1) * per_page;
        let total = users.len();
        let page_users: Vec<Value> = users.drain(..).skip(start).take(per_page).collect();
        return Json(json!({
            "users": page_users,
            "total": total,
            "page": page,
            "per_page": per_page,
        }))
        .into_response();
    }

    // GET /admin/users/{id}
    if parts.len() == 3 && parts[0] == "admin" && parts[1] == "users" {
        let Some(store) = st.emu.clone() else { return not_found_json() };
        return match store.admin_get_user(&parts[2]) {
            Some(u) => Json(u).into_response(),
            None => (StatusCode::NOT_FOUND, Json(json!({ "code": 404, "msg": "User not found" }))).into_response(),
        };
    }

    // GET /authorize — the consent page.
    if parts.len() == 1 && parts[0] == "authorize" {
        let provider = query_get(&q, "provider").unwrap_or("").to_string();
        if provider != "google" && provider != "apple" {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "unknown provider" }))).into_response();
        }
        let redirect_to = query_get(&q, "redirect_to").unwrap_or("").to_string();
        let challenge = query_get(&q, "code_challenge").unwrap_or("").to_string();
        let method = query_get(&q, "code_challenge_method").unwrap_or("S256").to_string();
        if redirect_to.is_empty() || challenge.is_empty() || method != "S256" {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid authorize request" }))).into_response();
        }
        // Same redirect_to shape check as the POST branch — reject anything
        // that is not a parseable URL to our own callback before rendering.
        let Ok(check) = url::Url::parse(&redirect_to) else {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid redirect_to" }))).into_response();
        };
        if check.path() != "/api/auth/callback" {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid redirect_to" }))).into_response();
        }
        return consent_page(&st, &origin, &provider, &redirect_to, &challenge, &method);
    }

    not_found_json()
}

pub async fn auth_post(State(st): State<St>, Path(action): Path<String>, RawQuery(raw): RawQuery, body: Bytes) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let parts = action_parts(&action);

    // POST /authorize — the consent submit.
    if parts.len() == 1 && parts[0] == "authorize" {
        let form = parse_query(Some(&String::from_utf8_lossy(&body)));
        let get = |k: &str| form.iter().find(|(key, _)| key == k).map(|(_, v)| v.clone()).unwrap_or_default();
        let provider = get("provider");
        let email = get("email").trim().to_lowercase();
        let redirect_to = get("redirect_to");
        let challenge = get("code_challenge");
        let method = get("code_challenge_method");

        if provider != "google" && provider != "apple" {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "unknown provider" }))).into_response();
        }
        if !email.contains('@') || email.len() > 120 {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid email" }))).into_response();
        }
        if challenge.is_empty() || method != "S256" {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid code_challenge" }))).into_response();
        }
        let Ok(mut target) = url::Url::parse(&redirect_to) else {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid redirect_to" }))).into_response();
        };
        if target.path() != "/api/auth/callback" {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid redirect_to" }))).into_response();
        }

        let Some(store) = st.emu.clone() else { return not_found_json() };
        let user = store.oauth_upsert_user(&provider, &email);
        let user_id = s(&user, "id");
        let code = issue_oauth_code(&st, &challenge, &user_id);
        target.query_pairs_mut().append_pair("code", &code);
        return Response::builder()
            .status(StatusCode::FOUND)
            .header("location", target.as_str())
            .body(axum::body::Body::empty())
            .unwrap();
    }

    // POST /admin/users — create.
    if parts.len() == 2 && parts[0] == "admin" && parts[1] == "users" {
        let Some(store) = st.emu.clone() else { return not_found_json() };
        let body: Value = match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid json" }))).into_response(),
        };
        let email = body.get("email").and_then(|e| e.as_str()).unwrap_or("").trim().to_lowercase();
        let password = body.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
        let meta = body.get("user_metadata").cloned().unwrap_or(json!({}));
        let full_name = meta.get("full_name").and_then(|f| f.as_str()).unwrap_or("").to_string();
        if email.is_empty() || password.is_empty() {
            return (StatusCode::BAD_REQUEST, Json(json!({ "message": "email and password required" }))).into_response();
        }
        return match store.admin_create_user(&email, &password, &full_name, body.get("email_confirm") == Some(&json!(true)), &meta) {
            Ok(u) => Json(u).into_response(),
            Err((status, body)) => (StatusCode::from_u16(status).unwrap(), Json(serde_json::from_str(&body).unwrap_or(json!({})))).into_response(),
        };
    }

    // POST /token?grant_type=…
    if parts.len() == 1 && parts[0] == "token" {
        let q = parse_query(raw.as_deref());
        let grant = query_get(&q, "grant_type").unwrap_or("").to_string();

        let body: Value = match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid json" }))).into_response(),
        };

        if grant == "pkce" {
            let auth_code = s(&body, "auth_code");
            let verifier = s(&body, "code_verifier");
            return match pkce_exchange(&st, &auth_code, &verifier).await {
                Ok(v) => Json(v).into_response(),
                Err(_) => (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "invalid_grant", "error_description": "Invalid auth code" })),
                )
                    .into_response(),
            };
        }

        if grant != "password" {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "unsupported_grant_type", "error_description": format!("Unsupported grant_type: {grant}") })),
            )
                .into_response();
        }

        let Some(store) = st.emu.clone() else { return not_found_json() };
        let email = body.get("email").and_then(|e| e.as_str()).unwrap_or("").trim().to_lowercase();
        let password = body.get("password").and_then(|p| p.as_str()).unwrap_or("");
        return match store.password_login(&email, password) {
            Ok(v) => Json(v).into_response(),
            Err((status, body)) => {
                let parsed: Value = serde_json::from_str(&body).unwrap_or(json!({}));
                (StatusCode::from_u16(status).unwrap(), Json(parsed)).into_response()
            }
        };
    }

    not_found_json()
}

pub async fn auth_put(State(st): State<St>, Path(action): Path<String>, body: Bytes) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let parts = action_parts(&action);

    if parts.len() == 3 && parts[0] == "admin" && parts[1] == "users" {
        let Some(store) = st.emu.clone() else { return not_found_json() };
        let body: Value = match serde_json::from_slice(&body) {
            Ok(v) => v,
            Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({ "message": "invalid json" }))).into_response(),
        };
        return match store.admin_update_user(&parts[2], &body) {
            Ok(u) => Json(u).into_response(),
            Err((status, body)) => (StatusCode::from_u16(status).unwrap(), Json(serde_json::from_str(&body).unwrap_or(json!({})))).into_response(),
        };
    }
    not_found_json()
}

pub async fn auth_delete(State(st): State<St>, Path(action): Path<String>) -> Response {
    if let Some(blocked) = emu_guard(&st) {
        return blocked;
    }
    let parts = action_parts(&action);

    if parts.len() == 3 && parts[0] == "admin" && parts[1] == "users" {
        let Some(store) = st.emu.clone() else { return not_found_json() };
        return match store.admin_delete_user(&parts[2]) {
            Ok(()) => Json(json!({ "message": "User deleted successfully" })).into_response(),
            Err((status, body)) => (StatusCode::from_u16(status).unwrap(), Json(serde_json::from_str(&body).unwrap_or(json!({})))).into_response(),
        };
    }
    not_found_json()
}
