//! Shared helpers — time, randomness, encoding, message-tree lookups and
//! the Baku wall-clock arithmetic. Ports of the tiny utilities the merged
//! backend used (crypto, baku.ts, gym.ts msgPath/fillMsg).

use base64::Engine;
use chrono::{DateTime, Datelike, NaiveDate, SecondsFormat, TimeZone, Timelike, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub type Row = serde_json::Map<String, serde_json::Value>;
pub type Json = serde_json::Value;

/* ── time ──────────────────────────────────────────────────────────────── */

/// "2026-11-20T17:08:59.123Z" — JS `new Date().toISOString()`.
pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn ms_to_iso(ms: i64) -> String {
    match Utc.timestamp_millis_opt(ms) {
        chrono::LocalResult::Single(t) => t.to_rfc3339_opts(SecondsFormat::Millis, true),
        _ => now_iso(),
    }
}

pub fn iso_plus_ms(ms: i64) -> String {
    ms_to_iso(now_ms() + ms)
}

/// Unix epoch milliseconds.
pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// JS `Date.parse` for the ISO strings this app writes (RFC3339 with
/// millisecond precision). Returns None on anything else.
pub fn parse_iso_ms(s: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc).timestamp_millis())
}

/// "YYYY-MM-DD" for the current UTC instant.
pub fn utc_date(ms: i64) -> String {
    ms_to_utc_date(ms).unwrap_or_default()
}

fn ms_to_utc_date(ms: i64) -> Option<String> {
    let dt = Utc.timestamp_millis_opt(ms).single()?;
    Some(dt.format("%Y-%m-%d").to_string())
}

/// Day-shift a "YYYY-MM-DD" string (UTC arithmetic — dates only).
pub fn plus_days(date: &str, days: i64) -> String {
    match NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        Ok(d) => (d + chrono::Duration::days(days)).format("%Y-%m-%d").to_string(),
        Err(_) => date.to_string(),
    }
}

/* ── Baku wall-clock (UTC+4, no DST since 2016) ────────────────────────── */

pub const BAKU_OFFSET_MS: i64 = 4 * 60 * 60 * 1000;

pub struct BakuParts {
    pub date: String,
    pub hour: i64,
    /// Mon=1 … Sun=7
    pub weekday: i64,
}

pub fn baku_parts(ms: i64) -> BakuParts {
    let shifted = ms + BAKU_OFFSET_MS;
    let dt = Utc
        .timestamp_millis_opt(shifted)
        .single()
        .unwrap_or_else(Utc::now);
    let wd = dt.weekday().number_from_monday() as i64;
    BakuParts { date: dt.format("%Y-%m-%d").to_string(), hour: dt.hour() as i64, weekday: wd }
}

/// UTC instant (ms) of a Baku wall-clock date ("YYYY-MM-DD") + hour.
pub fn baku_instant(date: &str, hour: i64) -> Option<i64> {
    if !is_date_str(date) {
        return None;
    }
    let d = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let dt = d
        .and_hms_opt(hour.clamp(0, 23) as u32, 0, 0)?;
    Some(dt.and_utc().timestamp_millis() - BAKU_OFFSET_MS)
}

/// "YYYY-MM-DD" shape check (TS /^\d{4}-\d{2}-\d{2}$/).
pub fn is_date_str(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[0..4].iter().all(u8::is_ascii_digit)
        && b[4] == b'-'
        && b[5..7].iter().all(u8::is_ascii_digit)
        && b[7] == b'-'
        && b[8..10].iter().all(u8::is_ascii_digit)
}

/// Weekday (Mon=1 … Sun=7) of a "YYYY-MM-DD" date.
pub fn weekday_of(date: &str) -> Option<i64> {
    let d = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    Some(d.weekday().number_from_monday() as i64)
}

/* ── randomness & hashing ──────────────────────────────────────────────── */

pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut buf = vec![0u8; n];
    rand::thread_rng().fill_bytes(&mut buf);
    buf
}

/// randomBytes(n).toString("base64url")
pub fn random_token(n: usize) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random_bytes(n))
}

pub fn uuid_v4() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn sha256_hex(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    hex(&h.finalize())
}

pub fn sha256_b64url(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(h.finalize())
}

pub fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

/* ── encoding ──────────────────────────────────────────────────────────── */

/// encodeURIComponent() — unreserved set [A-Za-z0-9]-_.!~*'().
const URI_ENCODE: &percent_encoding::AsciiSet = &percent_encoding::CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'$')
    .add(b'%')
    .add(b'&')
    .add(b'+')
    .add(b',')
    .add(b'/')
    .add(b':')
    .add(b';')
    .add(b'<')
    .add(b'=')
    .add(b'>')
    .add(b'?')
    .add(b'@')
    .add(b'[')
    .add(b'\\')
    .add(b']')
    .add(b'^')
    .add(b'`')
    .add(b'{')
    .add(b'|')
    .add(b'}');

pub fn uri_encode(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, URI_ENCODE).to_string()
}

pub fn uri_decode(s: &str) -> String {
    percent_encoding::percent_decode_str(s)
        .decode_utf8()
        .map(|c| c.into_owned())
        .unwrap_or_else(|_| s.to_string())
}

/// Minimal HTML escaping (attributes and text nodes).
pub fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/* ── JSON row helpers (the TS `Row` idioms) ────────────────────────────── */

pub fn row_get<'a>(v: &'a Json, key: &str) -> Option<&'a Json> {
    v.as_object().and_then(|o| o.get(key))
}

/// `typeof row[key] === "string" ? row[key] : ""`
pub fn s<'a>(v: &'a Json, key: &str) -> String {
    match row_get(v, key) {
        Some(Json::String(s)) => s.clone(),
        _ => String::new(),
    }
}

pub fn s_opt<'a>(v: &'a Json, key: &str) -> Option<String> {
    match row_get(v, key) {
        Some(Json::String(s)) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }
}

pub fn is_true(v: &Json, key: &str) -> bool {
    matches!(row_get(v, key), Some(Json::Bool(true)))
}

pub fn n_opt(v: &Json, key: &str) -> Option<f64> {
    match row_get(v, key) {
        Some(Json::Number(n)) => n.as_f64(),
        _ => None,
    }
}

pub fn i64_opt(v: &Json, key: &str) -> Option<i64> {
    n_opt(v, key).map(|f| f as i64)
}

/// A trimmed, char-count-capped string (TS `str(v, max)`).
#[allow(dead_code)]
pub fn capped_str(v: &Json, key: &str, max: usize) -> Option<String> {
    match row_get(v, key) {
        Some(Json::String(s)) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.chars().take(max).collect())
            }
        }
        _ => None,
    }
}

/// Char count (JS `[...str].length` — Unicode code points).
pub fn char_len(s: &str) -> usize {
    s.chars().count()
}

/// v5.2 (security round 3): shared name charset gate — no control
/// characters (signup + complete + profile PATCH all use it, so a stored
/// name can never smuggle control sequences or HTML-significant bytes).
pub fn name_chars_ok(name: &str) -> bool {
    !name.chars().any(|c| c.is_control())
}

/// JS `str.slice(0, n)` by code points.
pub fn char_take(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

/* ── message trees (gym.ts msgPath / fillMsg) ──────────────────────────── */

/// Read "a.b.c" out of a nested message tree.
pub fn msg_path<'a>(tree: &'a Json, path: &str) -> Option<&'a str> {
    let mut cur = tree;
    for part in path.split('.') {
        cur = cur.as_object().and_then(|o| o.get(part))?;
    }
    cur.as_str()
}

/// {count}/{from}/{to} template fill (gym.ts fillMsg).
pub fn fill_msg(tpl: &str, params: &serde_json::Map<String, Json>) -> String {
    let mut out = tpl.to_string();
    for (k, v) in params {
        let sv = match v {
            Json::String(s) => s.clone(),
            Json::Number(n) => {
                if n.as_i64().is_some() && n.as_i64() != Some(0) && n.as_f64() == Some(n.as_f64().unwrap().trunc()) {
                    n.as_i64().unwrap().to_string()
                } else if let Some(f) = n.as_f64() {
                    format!("{f}")
                } else {
                    String::new()
                }
            }
            _ => continue,
        };
        out = out.replace(&format!("{{{k}}}"), &sv);
    }
    out
}

/* ── query strings & cookies ───────────────────────────────────────────── */

/// Parse a raw query string into decoded (key, value) pairs, repeated
/// keys preserved.
pub fn parse_query(raw: Option<&str>) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let Some(q) = raw else { return out };
    for pair in q.split('&') {
        if pair.is_empty() {
            continue;
        }
        let (k, v) = match pair.split_once('=') {
            Some((k, v)) => (k, v),
            None => (pair, ""),
        };
        out.push((uri_decode(&k.replace('+', " ")), uri_decode(&v.replace('+', " "))));
    }
    out
}

pub fn query_get<'a>(q: &'a [(String, String)], key: &str) -> Option<&'a str> {
    q.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str())
}

/// Build a query string from (key, value) pairs, encoding values.
pub fn build_query(pairs: &[(String, String)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", uri_encode(k), uri_encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}

/// Parse a raw Cookie header into (name, value) pairs.
pub fn parse_cookies(raw: Option<&str>) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let Some(c) = raw else { return out };
    for part in c.split(';') {
        let p = part.trim();
        if let Some((k, v)) = p.split_once('=') {
            out.push((k.trim().to_string(), v.trim().to_string()));
        }
    }
    out
}

pub fn cookie_get<'a>(cookies: &'a [(String, String)], name: &str) -> Option<&'a str> {
    cookies.iter().find(|(k, _)| k == name).map(|(_, v)| v.as_str())
}

/// v5.2 (security round 2): the host part of an Origin header value
/// ("https://app.example.com:8443" -> "app.example.com"), or None for
/// "null"/malformed values. Used by the CSRF origin guard.
pub fn origin_host(origin: &str) -> Option<String> {
    if origin.eq_ignore_ascii_case("null") || origin.is_empty() {
        return None;
    }
    let rest = origin.split("://").nth(1).unwrap_or(origin);
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    // Drop an explicit port; keep the last colon segment only when it is
    // all digits (plain hostnames pass through untouched).
    let host = match authority.rsplit_once(':') {
        Some((h, p)) if !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()) => h,
        _ => authority,
    };
    if host.is_empty() { None } else { Some(host.to_string()) }
}
