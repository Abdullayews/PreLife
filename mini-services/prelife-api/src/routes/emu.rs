//! The local Supabase emulator's HTTP surface — /api/supa-emu/* (DEV
//! only, SUPABASE_EMU=1).
//!
//! v5.2 (security round 2): the HTTP surface is the **consent page only**
//! (GET/POST authorize). Everything else — the PostgREST REST mirror, the
//! GoTrue admin routes (user create/update/delete/list), the token
//! endpoint — is called **in-process** by `src/supa.rs` (Supa::Emu talks
//! straight to the EmuStore) and must never be reachable over HTTP: an
//! open REST route meant anyone could read `sessions` (token hashes),
//! INSERT a known hash bound to a victim's user_id (full account
//! takeover), PATCH `profiles` (role/psychSlug privilege escalation) or
//! create admin users with zero authentication. Those routes now 404.

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
/* v5.2 (security round 2): NO HTTP REST surface. Supa::Emu reaches the
 * EmuStore in-process (src/supa.rs); the router no longer registers these
 * paths, and the store's rest_* methods are the in-process API only.  */

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
    <p class="hint">Hesab varsa dərhal açılır; yoxdursa bu razılıq onu dərhal yaradır — təsdiq maili göndərilmir.</p>
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
    let mut res = (
        [(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")],
        html,
    )
        .into_response();
    // v5.2 (loop iter 3, security round): the consent page runs no scripts
    // and styles inline — a strict CSP makes even a future escaping slip
    // inert. form-action covers the POST to the emu authorize endpoint.
    res.headers_mut().insert(
        "content-security-policy",
        axum::http::HeaderValue::from_static(
            "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
        ),
    );
    res
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

    // v5.2 (security round 2): the admin/users GET branches (list + fetch
    // by id) were removed from the HTTP surface — in-process callers use
    // EmuStore directly; over HTTP they were an unauthenticated user
    // directory dump. GET /authorize (the consent page) is the only
    // browser-facing action.

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

pub async fn auth_post(State(st): State<St>, Path(action): Path<String>, body: Bytes) -> Response {
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
        // v5.2 (security round 5): the consent page may only mint sessions
        // for the emulator's own synthetic identities — the exact emails it
        // pre-fills. Before this allowlist, POSTing the consent form with
        // ANY registered account's email minted a full pl_session for that
        // account: password-free takeover of a real user (reproduced with
        // r5victim@test.dev). oauth_upsert_user now only ever sees the two
        // synthetic identities, so real accounts stay unreachable here.
        if email != emu_identities(&provider).0 {
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

    // v5.2 (security round 2): POST /admin/users (create) and POST /token
    // (password/PKCE grants) removed from the HTTP surface — unauthenticated
    // admin-create was a full account forger, and the token mirror leaked
    // password-grant probing. In-process callers (Supa::Emu) are unaffected.

    not_found_json()
}
