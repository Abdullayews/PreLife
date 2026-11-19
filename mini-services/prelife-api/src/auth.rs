use crate::supabase::Supa;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::RngCore;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;

pub const SESSION_COOKIE: &str = "pl_session";
pub const SESSION_TTL_S: i64 = 60 * 60 * 24 * 365; // 1 year, sliding
const RENEW_EVERY_MS: i64 = 60 * 60 * 1000; // refresh at most once an hour

const DEVICE_ICONS: [&str; 10] = [
    "monitor", "laptop", "smartphone", "tablet", "watch",
    "tv", "gamepad", "headphones", "briefcase", "home",
];

pub struct ApiError(pub StatusCode, pub Value);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(self.1)).into_response()
    }
}
pub fn err(status: StatusCode, code: &str) -> ApiError {
    ApiError(status, json!({ "error": code }))
}
pub fn generic() -> ApiError {
    err(StatusCode::INTERNAL_SERVER_ERROR, "generic")
}

/* ── App state ───────────────────────────────────────────────────────────── */

pub struct AppState {
    pub supa: Supa,
    pub cache: crate::cache::TtlCache,
    pub zai: Option<crate::config::ZaiConfig>,
    pub started: std::time::Instant,
}
pub type App = Arc<AppState>;

/* ── Sessions ────────────────────────────────────────────────────────────── */
/* Accounts live in the database: auth.users (Supabase Auth) holds the
 * credentials — signup goes through the admin API (the handle_new_user
 * trigger creates the profiles row) and login is verified by GoTrue's
 * password grant. This service only mints its own cookie sessions so the
 * Devices screen (Settings) keeps working; the user's id/email/name ride
 * along on the session row. */

fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone)]
pub struct SessionUser {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
}

#[derive(Clone)]
pub struct CurrentSession {
    pub session_id: String,
    pub device_name: String,
    pub device_icon: String,
    pub user: SessionUser,
}

pub fn user_view(u: &SessionUser) -> Value {
    json!({ "id": u.id, "email": u.email, "name": u.name })
}

/// A user as GoTrue returns it: { id, email, user_metadata: { full_name } }.
fn user_from_auth(row: &Value) -> Option<SessionUser> {
    Some(SessionUser {
        id: row.get("id")?.as_str()?.to_string(),
        email: row.get("email")?.as_str()?.to_string(),
        name: row
            .get("user_metadata")
            .and_then(|m| m.get("full_name"))
            .and_then(|v| v.as_str())
            .map(String::from),
    })
}

/* ── Device identification (mirrors src/lib/devices.ts) ─────────────────── */

fn describe_ua(ua: &str) -> (String, String, String) {
    let ua_l = ua.to_lowercase();
    let tablet = ua_l.contains("ipad") || ua_l.contains("tablet")
        || ua_l.contains("playbook") || ua_l.contains("silk")
        || (ua_l.contains("android") && !ua_l.contains("mobile"));
    let mobile = !tablet
        && (ua_l.contains("mobi") || ua_l.contains("iphone") || ua_l.contains("ipod")
            || ua_l.contains("android") || ua_l.contains("windows phone"));
    let kind = if tablet { "tablet" } else if mobile { "mobile" } else { "desktop" };

    let os = if ua_l.contains("windows") { "Windows" }
        else if ua_l.contains("iphone") || ua_l.contains("ipad") || ua_l.contains("ipod") { "iOS" }
        else if ua_l.contains("macintosh") || ua_l.contains("mac os x") { "macOS" }
        else if ua_l.contains("android") { "Android" }
        else if ua_l.contains("linux") || ua_l.contains("x11") { "Linux" }
        else { "" };

    let browser = if ua_l.contains("edg/") { "Edge" }
        else if ua_l.contains("opr/") || ua_l.contains("opera") { "Opera" }
        else if ua_l.contains("chromium") { "Chromium" }
        else if ua_l.contains("chrome/") { "Chrome" }
        else if ua_l.contains("firefox") { "Firefox" }
        else if ua_l.contains("safari/") { "Safari" }
        else { "" };

    (kind.to_string(), os.to_string(), browser.to_string())
}

pub fn default_device(ua: &str) -> (String, String) {
    let (kind, os, browser) = describe_ua(ua);
    let parts: Vec<&str> = [browser.as_str(), os.as_str()].into_iter()
        .filter(|s| !s.is_empty()).collect();
    let name = if !parts.is_empty() {
        parts.join(" · ")
    } else if kind == "mobile" { "Mobile".into() }
    else if kind == "tablet" { "Tablet".into() }
    else { "Desktop".into() };
    let icon = if kind == "mobile" { "smartphone" } else if kind == "tablet" { "tablet" } else { "monitor" };
    (name, icon.to_string())
}

pub async fn create_session(supa: &Supa, user: &SessionUser, user_agent: Option<&str>) -> Result<String, String> {
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token = URL_SAFE_NO_PAD.encode(token_bytes);
    let ua = user_agent.unwrap_or("");
    let (name, icon) = default_device(ua);
    let now = chrono::Utc::now();
    let expires = now + chrono::Duration::seconds(SESSION_TTL_S);
    let body = json!({
        "user_id": user.id,
        "user_email": user.email,
        "user_name": user.name,
        "token_hash": sha256_hex(&token),
        "device_name": name,
        "device_icon": icon,
        "user_agent": if ua.is_empty() { Value::Null } else { Value::from(ua.chars().take(300).collect::<String>()) },
        "expires_at": expires.to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
    });
    supa.insert("sessions", &body).await?;
    Ok(token)
}

/// Validates the cookie token: rejects unknown/expired sessions (deleting
/// the dead row) and slides the expiry forward past the throttle window.
pub async fn load_session(supa: &Supa, token: &str) -> Option<CurrentSession> {
    let row = supa.select_one("sessions", &[("select", "*"), ("token_hash", &format!("eq.{}", sha256_hex(token)))]).await.ok()??;

    let now = chrono::Utc::now();
    let expires_at = row.get("expires_at").and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&chrono::Utc));
    let Some(expires_at) = expires_at else { return None; };
    if expires_at <= now {
        let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let _ = supa.delete("sessions", &[("id", &format!("eq.{id}"))]).await;
        return None;
    }

    let last_used = row.get("last_used_at").and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&chrono::Utc))
        .unwrap_or(now);
    if (now - last_used).num_milliseconds() > RENEW_EVERY_MS {
        let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let new_exp = (now + chrono::Duration::seconds(SESSION_TTL_S))
            .to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
        let _ = supa.update("sessions", &[("id", &format!("eq.{id}"))],
            &json!({ "last_used_at": now.to_rfc3339_opts(chrono::SecondsFormat::Micros, true), "expires_at": new_exp })).await;
    }

    // The user rides on the session row (user_email / user_name) — written
    // at login/signup straight from the GoTrue response, so the hot path
    // needs no extra lookup.
    Some(CurrentSession {
        session_id: row.get("id")?.as_str()?.to_string(),
        device_name: row.get("device_name")?.as_str()?.to_string(),
        device_icon: row.get("device_icon")?.as_str().unwrap_or("monitor").to_string(),
        user: SessionUser {
            id: row.get("user_id")?.as_str()?.to_string(),
            email: row.get("user_email")?.as_str()?.to_string(),
            name: row.get("user_name").and_then(|v| v.as_str()).map(String::from),
        },
    })
}

/* ── Cookie helpers ──────────────────────────────────────────────────────── */

pub fn cookie_from_headers(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    for part in raw.split(';') {
        let part = part.trim();
        if let Some(v) = part.strip_prefix("pl_session=") {
            return Some(v.to_string());
        }
    }
    None
}

pub fn is_secure(headers: &HeaderMap) -> bool {
    headers.get("x-forwarded-proto").and_then(|v| v.to_str().ok()) == Some("https")
}

pub fn session_cookie_header(token: &str, secure: bool) -> String {
    format!("{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_TTL_S}; HttpOnly; SameSite=Lax{}",
        if secure { "; Secure" } else { "" })
}

pub fn clear_cookie_header(secure: bool) -> String {
    format!("{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax{}",
        if secure { "; Secure" } else { "" })
}

pub fn with_cookie(response: Response, cookie: String) -> Response {
    let (mut parts, body) = response.into_parts();
    if let Ok(v) = axum::http::HeaderValue::from_str(&cookie) {
        parts.headers.insert(axum::http::header::SET_COOKIE, v);
    }
    Response::from_parts(parts, body)
}

/* ── Current session ─────────────────────────────────────────────────────── */

/// The session from the request cookie, if any.
pub async fn current_session(supa: &Supa, headers: &HeaderMap) -> Option<CurrentSession> {
    let token = cookie_from_headers(headers)?;
    load_session(supa, &token).await
}

/* ── Body helpers ────────────────────────────────────────────────────────── */

pub fn parse_body(bytes: &Bytes) -> Value {
    serde_json::from_slice(bytes).unwrap_or(Value::Object(Map::new()))
}

pub fn str_field(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(|x| x.as_str()).map(String::from)
}

/* ── Auth handlers ───────────────────────────────────────────────────────── */

pub async fn signup(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let body = parse_body(&bytes);
    let name = str_field(&body, "name").map(|s| s.trim().to_string()).unwrap_or_default();
    let email = str_field(&body, "email").map(|s| s.trim().to_lowercase()).unwrap_or_default();
    let password = str_field(&body, "password").unwrap_or_default();

    if name.is_empty() || email.is_empty() || password.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "missing_fields"));
    }
    // /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let email_ok = {
        let parts: Vec<&str> = email.split('@').collect();
        parts.len() == 2
            && !parts[0].is_empty() && !parts[1].is_empty()
            && !parts[0].contains(char::is_whitespace) && !parts[1].contains(char::is_whitespace)
            && parts[1].contains('.')
            && !parts[1].split('.').any(|seg| seg.is_empty())
    };
    if !email_ok {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_email"));
    }
    if password.chars().count() < 8 {
        return Err(err(StatusCode::BAD_REQUEST, "short_password"));
    }

    // The account lives in the database — Supabase Auth creates the
    // auth.users row (auto-confirmed) and the handle_new_user trigger
    // makes the profiles row.
    let created = app.supa.auth_admin_create_user(&email, &password, &name).await;
    let created = match created {
        Ok(v) => v,
        Err(e) => {
            if e.contains("422") {
                return Err(err(StatusCode::CONFLICT, "email_taken"));
            }
            if e.contains("gotrue 400") {
                return Err(err(StatusCode::BAD_REQUEST, "invalid_email"));
            }
            return Err(generic());
        }
    };
    let user = user_from_auth(&created).ok_or_else(generic)?;

    let ua = headers.get(axum::http::header::USER_AGENT).and_then(|v| v.to_str().ok());
    let token = create_session(&app.supa, &user, ua).await.map_err(|_| generic())?;

    Ok(with_cookie(
        (StatusCode::OK, Json(json!({ "user": user_view(&user) }))).into_response(),
        session_cookie_header(&token, is_secure(&headers)),
    ))
}

pub async fn login(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let body = parse_body(&bytes);
    let email = str_field(&body, "email").map(|s| s.trim().to_lowercase()).unwrap_or_default();
    let password = str_field(&body, "password").unwrap_or_default();
    if email.is_empty() || password.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "missing_fields"));
    }

    // Credentials are verified against the database (auth.users) by
    // GoTrue's password grant.
    let granted = app.supa.auth_password_login(&email, &password).await;
    let granted = match granted {
        Ok(v) => v,
        Err(e) => {
            if e.contains("invalid_grant") || e.contains("Invalid login credentials") {
                return Err(err(StatusCode::UNAUTHORIZED, "invalid_credentials"));
            }
            return Err(generic());
        }
    };
    let user = granted.get("user").ok_or_else(generic)?;
    let user = user_from_auth(user).ok_or_else(generic)?;

    let ua = headers.get(axum::http::header::USER_AGENT).and_then(|v| v.to_str().ok());
    let token = create_session(&app.supa, &user, ua).await.map_err(|_| generic())?;

    Ok(with_cookie(
        (StatusCode::OK, Json(json!({ "user": user_view(&user) }))).into_response(),
        session_cookie_header(&token, is_secure(&headers)),
    ))
}

pub async fn logout(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    if let Some(token) = cookie_from_headers(&headers) {
        let _ = app.supa.delete("sessions", &[("token_hash", &format!("eq.{}", sha256_hex(&token)))]).await;
    }
    Ok(with_cookie(
        (StatusCode::OK, Json(json!({ "ok": true }))).into_response(),
        clear_cookie_header(is_secure(&headers)),
    ))
}

pub async fn me(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let user = current_session(&app.supa, &headers).await.map(|cs| cs.user);
    Ok((StatusCode::OK, Json(json!({ "user": user.as_ref().map(user_view) }))).into_response())
}

/* ── OAuth (Google / Apple via Supabase Auth, PKCE S256) ─────────────────── */

const OAUTH_COOKIE: &str = "pl_oauth";
const OAUTH_TTL_S: i64 = 600;

#[derive(serde::Deserialize)]
pub struct CallbackParams {
    code: Option<String>,
    error: Option<String>,
}

/// SHA-256 then base64url without padding — the S256 code_challenge format
/// GoTrue requires (hex digests are rejected).
fn sha256_b64url(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    URL_SAFE_NO_PAD.encode(h.finalize())
}

/// Minimal encodeURIComponent for the redirect_to query parameter.
fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 16);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// The public origin the browser sees (x-forwarded-host beats host; proto
/// from x-forwarded-proto). OAuth redirect_to must return there — the API's
/// own listen address is unreachable from the outside world.
fn origin_from_headers(headers: &HeaderMap) -> String {
    let proto = headers.get("x-forwarded-proto").and_then(|v| v.to_str().ok())
        .filter(|p| !p.is_empty())
        .unwrap_or("http");
    let host = headers.get("x-forwarded-host").and_then(|v| v.to_str().ok())
        .filter(|h| !h.is_empty())
        .or_else(|| headers.get(axum::http::header::HOST).and_then(|v| v.to_str().ok()))
        .filter(|h| !h.is_empty())
        .unwrap_or("127.0.0.1:3000");
    format!("{proto}://{host}")
}

fn see_other(location: String, cookies: Vec<String>) -> Response {
    let mut builder = axum::http::Response::builder()
        .status(StatusCode::FOUND)
        .header("location", location);
    for c in cookies {
        builder = builder.header("set-cookie", c);
    }
    builder.body(axum::body::Body::empty()).expect("static response")
}

/// GET /api/auth/oauth/{google|apple} — starts the OAuth flow: mints a
/// PKCE verifier (kept in a short-lived HttpOnly cookie), then redirects to
/// Supabase's /authorize. Provider credentials live in Supabase
/// (Authentication → Providers); without them GoTrue answers 400.
pub async fn oauth_start(State(app): State<App>, headers: HeaderMap, Path(provider): Path<String>) -> Result<Response, ApiError> {
    if provider != "google" && provider != "apple" {
        return Err(err(StatusCode::NOT_FOUND, "unknown_provider"));
    }
    let origin = origin_from_headers(&headers);
    let redirect_to = format!("{origin}/api/auth/callback");

    let mut vb = [0u8; 48];
    rand::thread_rng().fill_bytes(&mut vb);
    let verifier = URL_SAFE_NO_PAD.encode(vb); // 64 chars — inside 43..128
    let challenge = sha256_b64url(&verifier);

    let url = format!(
        "{}/authorize?provider={provider}&redirect_to={}&code_challenge={challenge}&code_challenge_method=s090",
        app.supa.auth_base(),
        percent_encode(&redirect_to),
    );

    let cookie = format!("{OAUTH_COOKIE}={verifier}; Path=/; Max-Age={OAUTH_TTL_S}; HttpOnly; SameSite=Lax{}",
        if is_secure(&headers) { "; Secure" } else { "" });
    Ok(see_other(url, vec![cookie]))
}

/// GET /api/auth/callback?code=… — Supabase sends the visitor back here
/// after the provider dance. Exchanges the code with the PKCE verifier,
/// mints the pl_session cookie, clears the OAuth cookie and lands the user
/// on /home. Any failure goes to /login?error=oauth.
pub async fn oauth_callback(
    State(app): State<App>,
    headers: HeaderMap,
    axum::extract::Query(params): axum::extract::Query<CallbackParams>,
) -> Result<Response, ApiError> {
    let origin = origin_from_headers(&headers);

    let mut fail = |origin: &str| -> Response {
        see_other(format!("{origin}/login?error=oauth"), vec![format!(
            "{OAUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
        )])
    };

    let Some(code) = params.code.filter(|c| !c.is_empty()) else {
        return Ok(fail(&origin));
    };
    if params.error.is_some() {
        return Ok(fail(&origin));
    }
    let raw = headers.get(axum::http::header::COOKIE).and_then(|v| v.to_str().ok()).unwrap_or("");
    let Some(verifier) = raw.split(';').map(str::trim)
        .find_map(|p| p.strip_prefix(&format!("{OAUTH_COOKIE}="))) else {
        return Ok(fail(&origin));
    };

    let user = app.supa.auth_pkce_exchange(&code, verifier).await.ok()
        .and_then(|v| v.get("user").cloned())
        .and_then(|u| user_from_auth(&u));
    let Some(user) = user else {
        return Ok(fail(&origin));
    };

    let ua = headers.get(axum::http::header::USER_AGENT).and_then(|v| v.to_str().ok());
    let Ok(token) = create_session(&app.supa, &user, ua).await else {
        return Ok(fail(&origin));
    };

    Ok(see_other(
        format!("{origin}/home"),
        vec![
            session_cookie_header(&token, is_secure(&headers)),
            format!("{OAUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"),
        ],
    ))
}

/* ── User preferences (language + theme on the profiles row) ──────────────── */

fn prefs_view(row: Option<&Value>) -> Value {
    json!({
        "locale": row.and_then(|r| r.get("lang")).and_then(|v| v.as_str()).unwrap_or("en"),
        "theme": row.and_then(|r| r.get("theme")).and_then(|v| v.as_str()).unwrap_or("light"),
    })
}

/// GET /api/me/preferences — the signed-in user's saved language + theme.
pub async fn preferences_get(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let Some(current) = current_session(&app.supa, &headers).await else {
        return Err(err(StatusCode::UNAUTHORIZED, "unauthorized"));
    };
    let row = app.supa.select_one("profiles", &[
        ("select", "lang,theme"),
        ("id", &format!("eq.{}", current.user.id)),
    ]).await.map_err(|_| generic())?;
    Ok((StatusCode::OK, Json(prefs_view(row.as_ref()))).into_response())
}

/// PATCH /api/me/preferences { locale?, theme? } — saves the UI choice on
/// the profile row so it follows the account across devices.
pub async fn preferences_update(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let Some(current) = current_session(&app.supa, &headers).await else {
        return Err(err(StatusCode::UNAUTHORIZED, "unauthorized"));
    };
    let body = parse_body(&bytes);
    let mut patch = Map::new();
    if let Some(loc) = str_field(&body, "locale") {
        if !["az", "en", "ru"].contains(&loc.as_str()) {
            return Err(err(StatusCode::BAD_REQUEST, "invalid_locale"));
        }
        patch.insert("lang".into(), Value::from(loc));
    }
    if let Some(theme) = str_field(&body, "theme") {
        if !["light", "dark"].contains(&theme.as_str()) {
            return Err(err(StatusCode::BAD_REQUEST, "invalid_theme"));
        }
        patch.insert("theme".into(), Value::from(theme));
    }
    if patch.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "nothing_to_update"));
    }
    let rows = app.supa.update("profiles", &[("id", &format!("eq.{}", current.user.id))], &Value::Object(patch))
        .await.map_err(|_| generic())?;
    Ok((StatusCode::OK, Json(prefs_view(rows.first()))).into_response())
}

/* ── Devices (Settings → Devices) ────────────────────────────────────────── */

fn device_view(row: &Value, current_id: &str) -> Value {
    let id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default();
    json!({
        "id": id,
        "name": row.get("device_name"),
        "icon": row.get("device_icon"),
        "current": id == current_id,
        "createdAt": row.get("created_at"),
        "lastUsedAt": row.get("last_used_at"),
    })
}

pub async fn devices_list(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let Some(current) = current_session(&app.supa, &headers).await else {
        return Err(err(StatusCode::UNAUTHORIZED, "unauthorized"));
    };
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    let _ = app.supa.delete("sessions", &[
        ("user_id", &format!("eq.{}", current.user.id)),
        ("expires_at", &format!("lt.{now}")),
    ]).await;

    let rows = app.supa.select("sessions", &[
        ("select", "*"),
        ("user_id", &format!("eq.{}", current.user.id)),
        ("order", "last_used_at.desc"),
    ]).await.map_err(|_| generic())?;

    let devices: Vec<Value> = rows.iter().map(|r| device_view(r, &current.session_id)).collect();
    Ok((StatusCode::OK, Json(json!({ "devices": devices }))).into_response())
}

async fn own_session(app: &App, headers: &HeaderMap, id: &str) -> Result<(CurrentSession, Value), ApiError> {
    let current = current_session(&app.supa, headers).await
        .ok_or_else(|| err(StatusCode::UNAUTHORIZED, "unauthorized_or_missing"))?;
    let target = app.supa.select_one("sessions", &[("select", "*"), ("id", &format!("eq.{id}"))]).await
        .map_err(|_| generic())?;
    let target = target.filter(|t| t.get("user_id").and_then(|v| v.as_str()) == Some(current.user.id.as_str()))
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "unauthorized_or_missing"))?;
    Ok((current, target))
}

pub async fn device_update(State(app): State<App>, headers: HeaderMap, Path(id): Path<String>, bytes: Bytes) -> Result<Response, ApiError> {
    let (current, target) = own_session(&app, &headers, &id).await?;
    let target_id = target.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let body = parse_body(&bytes);

    let mut patch = Map::new();
    if let Some(name) = str_field(&body, "name") {
        let name = name.trim().to_string();
        if name.is_empty() || name.chars().count() > 40 {
            return Err(err(StatusCode::BAD_REQUEST, "invalid_name"));
        }
        patch.insert("device_name".into(), Value::from(name));
    }
    if let Some(icon) = str_field(&body, "icon") {
        if !DEVICE_ICONS.contains(&icon.as_str()) {
            return Err(err(StatusCode::BAD_REQUEST, "invalid_icon"));
        }
        patch.insert("device_icon".into(), Value::from(icon));
    }
    if patch.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "nothing_to_update"));
    }

    let rows = app.supa.update("sessions", &[("id", &format!("eq.{target_id}"))], &Value::Object(patch)).await
        .map_err(|_| generic())?;
    let row = rows.first().ok_or_else(|| err(StatusCode::NOT_FOUND, "unauthorized_or_missing"))?;
    Ok((StatusCode::OK, Json(json!({ "device": device_view(row, &current.session_id) }))).into_response())
}

pub async fn device_revoke(State(app): State<App>, headers: HeaderMap, Path(id): Path<String>) -> Result<Response, ApiError> {
    let (current, _) = own_session(&app, &headers, &id).await?;
    app.supa.delete("sessions", &[("id", &format!("eq.{id}"))]).await
        .map_err(|_| generic())?;
    Ok((StatusCode::OK, Json(json!({ "ok": true, "current": id == current.session_id }))).into_response())
}
