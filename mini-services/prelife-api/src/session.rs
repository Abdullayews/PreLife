//! The session layer — the Rust port of lib/server/session.ts (itself the
//! port of the original Rust auth.rs). Cookie sessions in public.sessions
//! with sha256 token hashing, device tracking, the 30s lookup cache and
//! the v4.7 hardened origin resolution.

use crate::error::DomainError;
use crate::state::{CurrentSession, St};
use crate::util::*;
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use serde_json::{json, Map, Value};
use std::time::{Duration, Instant};

pub const SESSION_COOKIE: &str = "pl_session";
pub const SESSION_TTL_S: i64 = 60 * 60 * 24 * 365; // 1 year, sliding
const RENEW_EVERY_MS: i64 = 60 * 60 * 1000; // refresh at most once an hour

pub const OAUTH_COOKIE: &str = "pl_oauth";
pub const OAUTH_TTL_S: i64 = 600;

pub const DEVICE_ICONS: &[&str] = &[
    "monitor", "laptop", "smartphone", "tablet", "watch",
    "tv", "gamepad", "headphones", "briefcase", "home",
];

const SESSION_CACHE_TTL: Duration = Duration::from_secs(30);
const SESSION_CACHE_NEG_TTL: Duration = Duration::from_secs(10);
const SESSION_CACHE_MAX: usize = 5_000;

pub fn token_key(token: &str) -> String {
    sha256_hex(token)
}

/* ── device identification (mirrors src/lib/devices.ts) ────────────────── */

pub struct DeviceInfo {
    pub name: String,
    pub icon: String,
}

fn describe_ua(ua: &str) -> (String, String, String) {
    let l = ua.to_lowercase();
    let tablet = l.contains("ipad")
        || l.contains("tablet")
        || l.contains("playbook")
        || l.contains("silk")
        || (l.contains("android") && !l.contains("mobile"));
    let mobile = !tablet
        && (l.contains("mobi")
            || l.contains("iphone")
            || l.contains("ipod")
            || l.contains("android")
            || l.contains("windows phone"));
    let kind = if tablet { "tablet" } else if mobile { "mobile" } else { "desktop" };

    let os = if l.contains("windows") {
        "Windows"
    } else if l.contains("iphone") || l.contains("ipad") || l.contains("ipod") {
        "iOS"
    } else if l.contains("macintosh") || l.contains("mac os x") {
        "macOS"
    } else if l.contains("android") {
        "Android"
    } else if l.contains("linux") || l.contains("x11") {
        "Linux"
    } else {
        ""
    };

    let browser = if l.contains("edg/") {
        "Edge"
    } else if l.contains("opr/") || l.contains("opera") {
        "Opera"
    } else if l.contains("chromium") {
        "Chromium"
    } else if l.contains("chrome/") {
        "Chrome"
    } else if l.contains("firefox") {
        "Firefox"
    } else if l.contains("safari/") {
        "Safari"
    } else {
        ""
    };

    (kind.to_string(), os.to_string(), browser.to_string())
}

pub fn default_device(ua: &str) -> DeviceInfo {
    let (kind, os, browser) = describe_ua(ua);
    let parts: Vec<&str> = [browser.as_str(), os.as_str()].iter().copied().filter(|s| !s.is_empty()).collect();
    let name = if !parts.is_empty() {
        parts.join(" · ")
    } else if kind == "mobile" {
        "Mobile".to_string()
    } else if kind == "tablet" {
        "Tablet".to_string()
    } else {
        "Desktop".to_string()
    };
    let icon = if kind == "mobile" {
        "smartphone"
    } else if kind == "tablet" {
        "tablet"
    } else {
        "monitor"
    };
    DeviceInfo { name, icon: icon.to_string() }
}

/* ── the user view (the /api/auth/me shape) ────────────────────────────── */

pub fn user_view(u: &Value) -> Value {
    let role = if u.get("role") == Some(&json!("psychologist")) { "psychologist" } else { "user" };
    json!({
        "id": u.get("id").cloned().unwrap_or(Value::Null),
        "email": u.get("email").cloned().unwrap_or(Value::Null),
        "name": u.get("name").cloned().unwrap_or(Value::Null),
        "avatar": u.get("avatar").filter(|v| !v.is_null()).cloned().unwrap_or(Value::Null),
        "railFolded": u.get("railFolded") == Some(&json!(true)),
        "role": role,
        "psychSlug": if role == "psychologist" {
            u.get("psychSlug").and_then(|v| v.as_str()).map(String::from).map(Value::String).unwrap_or(Value::Null)
        } else { Value::Null },
        "location": if u.get("location") == Some(&json!("az")) { "az" } else { "global" },
    })
}

/// The enriched session user written onto session rows.
fn session_user(id: &str, email: &str, name: Option<String>, avatar: Option<String>, rail_folded: bool, role: &str, psych_slug: Option<String>, location: &str) -> Value {
    json!({
        "id": id,
        "email": email,
        "name": name,
        "avatar": avatar,
        "railFolded": rail_folded,
        "role": role,
        "psychSlug": psych_slug,
        "location": location,
    })
}

/* ── create ────────────────────────────────────────────────────────────── */

/// Mint a session row for the user. `user` = { id, email, name } (the
/// GoTrue shape); avatar/role/etc. ride from the profiles row.
pub async fn create_session(
    st: &St,
    user: &Value,
    user_agent: Option<&str>,
) -> Result<(String, Value), DomainError> {
    let token = random_token(32);
    let ua = user_agent.unwrap_or("");
    let device = default_device(ua);

    let uid = s(user, "id");
    let email = s(user, "email");
    let name = s_opt(user, "name");

    let mut avatar: Option<String> = None;
    let mut rail_folded = false;
    let mut role = "user".to_string();
    let mut psych_slug: Option<String> = None;
    let mut location = "global".to_string();

    if let Some(prof) = st
        .supa
        .select_one("profiles", &vec![("select".into(), "*".into()), ("id".into(), format!("eq.{uid}"))])
        .await
        .ok()
        .flatten()
    {
        let pv = Value::Object(prof);
        avatar = s_opt(&pv, "avatar_url");
        rail_folded = is_true(&pv, "rail_folded");
        if s(&pv, "role") == "psychologist" {
            role = "psychologist".into();
        }
        if s(&pv, "content_location") == "az" {
            location = "az".into();
        }
    }
    if role == "psychologist" {
        if let Some(psy) = st
            .supa
            .select_one("psychologists_v2", &vec![("select".into(), "slug".into()), ("owner_id".into(), format!("eq.{uid}"))])
            .await
            .ok()
            .flatten()
        {
            let pv = Value::Object(psy);
            psych_slug = s_opt(&pv, "slug");
        }
        if psych_slug.is_none() {
            role = "user".into(); // not actually linked — plain user
        }
    }

    let mut row = Map::new();
    row.insert("user_id".into(), json!(uid));
    row.insert("user_email".into(), json!(email));
    row.insert("user_name".into(), name.clone().map(Value::String).unwrap_or(Value::Null));
    row.insert("user_avatar".into(), avatar.clone().map(Value::String).unwrap_or(Value::Null));
    row.insert("user_folded".into(), json!(rail_folded));
    row.insert("user_role".into(), json!(role));
    row.insert("user_psych".into(), psych_slug.clone().map(Value::String).unwrap_or(Value::Null));
    row.insert("user_location".into(), json!(location));
    row.insert("token_hash".into(), json!(sha256_hex(&token)));
    row.insert("device_name".into(), json!(device.name));
    row.insert("device_icon".into(), json!(device.icon));
    row.insert("user_agent".into(), if ua.is_empty() { Value::Null } else { json!(char_take(ua, 300)) });
    row.insert("expires_at".into(), json!(ms_to_iso(now_ms() + SESSION_TTL_S * 1000)));

    if st.supa.insert("sessions", &Value::Object(row.clone())).await.is_err() {
        // Pre-v3.3 databases: drop the newer columns and retry.
        for k in ["user_avatar", "user_folded", "user_role", "user_psych", "user_location"] {
            row.remove(k);
        }
        st.supa
            .insert("sessions", &Value::Object(row))
            .await
            .map_err(|_| DomainError::msg("session insert failed"))?;
    }

    Ok((
        token,
        session_user(&uid, &email, name, avatar, rail_folded, &role, psych_slug, &location),
    ))
}

/* ── load (with the v4.1 30s cache) ────────────────────────────────────── */

async fn load_session_row(st: &St, token: &str) -> Option<CurrentSession> {
    let hash = token_key(token);
    let row = st
        .supa
        .select_one("sessions", &vec![("select".into(), "*".into()), ("token_hash".into(), format!("eq.{hash}"))])
        .await
        .ok()?;
    let Some(row) = row else { return None };
    let v = Value::Object(row);

    let now = now_ms();
    let expires_at = s_opt(&v, "expires_at").and_then(|t| parse_iso_ms(&t));
    let expires_at = match expires_at {
        Some(t) => t,
        None => return None,
    };
    if expires_at <= now {
        let id = s(&v, "id");
        if !id.is_empty() {
            let _ = st
                .supa
                .delete("sessions", &vec![("id".into(), format!("eq.{id}"))])
                .await;
        }
        return None;
    }

    let last_used = s_opt(&v, "last_used_at").and_then(|t| parse_iso_ms(&t)).unwrap_or(now);
    if now - last_used > RENEW_EVERY_MS {
        let id = s(&v, "id");
        if !id.is_empty() {
            let _ = st
                .supa
                .update(
                    "sessions",
                    &vec![("id".into(), format!("eq.{id}"))],
                    &json!({
                        "last_used_at": ms_to_iso(now),
                        "expires_at": ms_to_iso(now + SESSION_TTL_S * 1000),
                    }),
                )
                .await;
        }
    }

    let uid = s_opt(&v, "user_id")?;
    let email = s_opt(&v, "user_email")?;
    let user = session_user(
        &uid,
        &email,
        s_opt(&v, "user_name"),
        s_opt(&v, "user_avatar"),
        is_true(&v, "user_folded"),
        &if s(&v, "user_role") == "psychologist" { "psychologist".to_string() } else { "user".to_string() },
        s_opt(&v, "user_psych"),
        &if s(&v, "user_location") == "az" { "az".to_string() } else { "global".to_string() },
    );
    Some(CurrentSession {
        session_id: s(&v, "id"),
        device_name: s(&v, "device_name"),
        device_icon: {
            let icon = s(&v, "device_icon");
            if icon.is_empty() { "monitor".to_string() } else { icon }
        },
        user,
    })
}

/// Cached session validation.
pub async fn load_session(st: &St, token: &str) -> Option<CurrentSession> {
    let key = token_key(token);
    {
        let map = st.session_cache.lock().unwrap();
        if let Some(hit) = map.get(&key) {
            let ttl = if hit.cs.is_some() { SESSION_CACHE_TTL } else { SESSION_CACHE_NEG_TTL };
            if hit.at.elapsed() < ttl {
                return hit.cs.clone();
            }
        }
    }
    let cs = load_session_row(st, token).await;
    {
        let mut map = st.session_cache.lock().unwrap();
        map.insert(key.clone(), crate::state::SessionCacheEntry { at: Instant::now(), cs: cs.clone() });
        if map.len() > SESSION_CACHE_MAX {
            if let Some(k) = map.keys().find(|k| *k != &key).cloned() {
                map.remove(&k);
            }
        }
    }
    cs
}

/// The current session from a request's Cookie header.
pub async fn current_session(st: &St, headers: &HeaderMap) -> Option<CurrentSession> {
    let cookies = parse_cookies(headers.get("cookie").and_then(|v| v.to_str().ok()));
    let token = cookie_get(&cookies, SESSION_COOKIE)?;
    load_session(st, token).await
}

/// Delete the session row behind a cookie token (logout).
pub async fn revoke_token_session(st: &St, token: &str) {
    st.session_cache_drop_token(token);
    let _ = st
        .supa
        .delete("sessions", &vec![("token_hash".into(), format!("eq.{}", token_key(token)))])
        .await;
}

/* ── cookies ───────────────────────────────────────────────────────────── */

pub fn is_secure(headers: &HeaderMap) -> bool {
    headers.get("x-forwarded-proto").and_then(|v| v.to_str().ok()) == Some("https")
}

pub fn session_cookie(token: &str, secure: bool) -> String {
    format!("{SESSION_COOKIE}={token}; Path=/; Max-Age={SESSION_TTL_S}; HttpOnly; SameSite=Lax{}", if secure { "; Secure" } else { "" })
}

pub fn cleared_session_cookie(secure: bool) -> String {
    format!("{SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax{}", if secure { "; Secure" } else { "" })
}

pub fn cleared_oauth_cookie(secure: bool) -> String {
    format!("{OAUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax{}", if secure { "; Secure" } else { "" })
}

/// v4.4: "<locale>.<mode>.<minted-ms>.<verifier>".
pub fn oauth_cookie(verifier: &str, secure: bool, locale: &str, mode: &str) -> String {
    format!("{OAUTH_COOKIE}={locale}.{mode}.{}.{verifier}; Path=/; Max-Age={OAUTH_TTL_S}; HttpOnly; SameSite=Lax{}", now_ms(), if secure { "; Secure" } else { "" })
}

/// The pl_oauth verifier (mint-stamp format stripped). Backwards
/// compatible with the v4.3/v4.4/bare shapes.
#[allow(dead_code)]
pub fn oauth_verifier_from_cookies(cookies: &[(String, String)]) -> Option<String> {
    let v = cookie_get(cookies, OAUTH_COOKIE)?;
    // az.login.<ms>.<verifier>
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() >= 4
        && (parts[1] == "login" || parts[1] == "signup")
        && parts[2].len() >= 11
        && parts[2].chars().all(|c| c.is_ascii_digit())
    {
        return Some(parts[3..].join("."));
    }
    if parts.len() >= 3 && (parts[1] == "login" || parts[1] == "signup") {
        return Some(parts[2..].join("."));
    }
    // az.<verifier>
    if parts.len() >= 2 && parts[0].len() == 2 && parts[0].chars().all(|c| c.is_ascii_lowercase()) {
        return Some(parts[1..].join("."));
    }
    Some(v.to_string())
}

/// The full parsed pl_oauth cookie (callback route).
pub struct ParsedOauthCookie {
    pub locale: String,
    pub mode: String,
    pub minted: i64,
    pub verifier: Option<String>,
}

pub fn parse_oauth_cookie(cookies: &[(String, String)]) -> ParsedOauthCookie {
    let locale_of = |s: &str| if s == "en" || s == "ru" { s.to_string() } else { "az".to_string() };
    let Some(raw) = cookie_get(cookies, OAUTH_COOKIE) else {
        return ParsedOauthCookie { locale: "az".into(), mode: "login".into(), minted: 0, verifier: None };
    };
    let parts: Vec<&str> = raw.split('.').collect();
    if parts.len() >= 4
        && (parts[1] == "login" || parts[1] == "signup")
        && parts[2].len() >= 11
        && parts[2].chars().all(|c| c.is_ascii_digit())
    {
        return ParsedOauthCookie {
            locale: locale_of(parts[0]),
            mode: parts[1].to_string(),
            minted: parts[2].parse().unwrap_or(0),
            verifier: Some(parts[3..].join(".")),
        };
    }
    if parts.len() >= 3 && (parts[1] == "login" || parts[1] == "signup") {
        return ParsedOauthCookie {
            locale: locale_of(parts[0]),
            mode: parts[1].to_string(),
            minted: 0,
            verifier: Some(parts[2..].join(".")),
        };
    }
    if parts.len() >= 2 && parts[0].len() == 2 && parts[0].chars().all(|c| c.is_ascii_lowercase()) {
        return ParsedOauthCookie { locale: locale_of(parts[0]), mode: "login".into(), minted: 0, verifier: Some(parts[1..].join(".")) };
    }
    ParsedOauthCookie { locale: "az".into(), mode: "login".into(), minted: 0, verifier: Some(raw.to_string()) }
}

/* ── origin resolution (v4.7 hardened) ─────────────────────────────────── */

fn host_of(u: &str) -> Option<String> {
    url::Url::parse(u).ok().map(|parsed| match parsed.port() {
        Some(p) => format!("{}:{p}", parsed.host_str().unwrap_or("")),
        None => parsed.host_str().unwrap_or("").to_string(),
    })
}

fn is_local_host(host: &str) -> bool {
    let h = host.split(':').next().unwrap_or(host);
    h == "localhost" || h == "127.0.0.1" || h == "[::1]"
}

/// The public origin a request should be treated as (see session.ts).
pub fn origin_from(st: &St, headers: &HeaderMap) -> String {
    let proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("http");
    let host = headers
        .get("x-forwarded-host")
        .or_else(|| headers.get("host"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("127.0.0.1:3000")
        .split(',')
        .next()
        .unwrap_or("127.0.0.1:3000")
        .trim()
        .to_string();
    let host = if host.is_empty() { "127.0.0.1:3000".to_string() } else { host };
    let raw = format!("{proto}://{host}");

    let mut allowlist: Vec<String> = st
        .cfg
        .public_url
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if !st.cfg.site_url.is_empty() {
        allowlist.push(st.cfg.site_url.clone());
    }

    if !st.cfg.production && is_local_host(&host) {
        return raw;
    }
    if allowlist.iter().filter_map(|u| host_of(u)).any(|h| h == host) {
        return raw;
    }
    if !allowlist.is_empty() {
        return allowlist[0].clone();
    }
    raw
}

/* ── response helpers (redirect + Set-Cookie composition) ──────────────── */

pub fn redirect_with_cookies(url: &str, status: StatusCode, cookies: &[String]) -> Response {
    let mut res = Response::builder()
        .status(status)
        .header("location", url)
        .body(axum::body::Body::empty())
        .unwrap();
    let hv = res.headers_mut();
    for c in cookies {
        hv.append("set-cookie", c.parse().unwrap());
    }
    res
}

/// Append a gateway suffix to a browser-facing backend URL when the
/// service runs behind the sandbox gateway (API_TRANSFORM_PORT set).
pub fn gateway_url(st: &St, url: &str) -> String {
    if st.cfg.transform_port.is_empty() {
        return url.to_string();
    }
    if url.contains("XTransformPort=") {
        return url.to_string();
    }
    let sep = if url.contains('?') { '&' } else { '?' };
    format!("{url}{sep}XTransformPort={}", st.cfg.transform_port)
}
