//! AppState — the shared service state: config, HTTP client, the supa
//! transport, the emulator's OAuth code map and the in-process caches
//! (sessions 30s, preferences 30s, content TTL 60s, rate-limit windows).

use crate::config::Config;
use crate::emu::EmuStore;
use crate::supa::Supa;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// A validated session (the CurrentSession shape).
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct CurrentSession {
    pub session_id: String,
    pub device_name: String,
    pub device_icon: String,
    /// { id, email, name, avatar, railFolded, role, psychSlug, location }
    pub user: Value,
}

#[derive(Clone)]
pub struct SessionCacheEntry {
    pub at: Instant,
    pub cs: Option<CurrentSession>,
}

#[derive(Clone)]
pub struct RateBucket {
    pub count: u32,
    pub reset_at: Instant,
}

/// The emulator's single-use OAuth codes (memory only).
#[derive(Clone)]
pub struct OAuthCode {
    pub challenge: String,
    pub user_id: String,
    pub expires: i64,
}

pub struct AppState {
    pub cfg: Config,
    pub http: reqwest::Client,
    pub supa: Supa,
    pub emu: Option<Arc<EmuStore>>,
    pub oauth_codes: Mutex<HashMap<String, OAuthCode>>,
    pub session_cache: Mutex<HashMap<String, SessionCacheEntry>>,
    pub rate: Mutex<HashMap<String, RateBucket>>,
    pub ttl: Mutex<HashMap<String, (Instant, Value)>>,
    pub prefs_cache: Mutex<HashMap<String, (Instant, Value)>>,
    pub started_at: Instant,
}

impl AppState {
    pub fn new(cfg: Config, http: reqwest::Client, supa: Supa, emu: Option<Arc<EmuStore>>) -> Self {
        Self {
            cfg,
            http,
            supa,
            emu,
            oauth_codes: Mutex::new(HashMap::new()),
            session_cache: Mutex::new(HashMap::new()),
            rate: Mutex::new(HashMap::new()),
            ttl: Mutex::new(HashMap::new()),
            prefs_cache: Mutex::new(HashMap::new()),
            started_at: Instant::now(),
        }
    }

    /* ── the 60s TTL cache (content + i18n + AI settings) ─────────────── */

    pub fn ttl_get(&self, key: &str) -> Option<Value> {
        let map = self.ttl.lock().unwrap();
        match map.get(key) {
            Some((at, v)) if at.elapsed() < Duration::from_secs(60) => Some(v.clone()),
            _ => None,
        }
    }

    pub fn ttl_put(&self, key: &str, v: Value) {
        self.ttl
            .lock()
            .unwrap()
            .insert(key.to_string(), (Instant::now(), v));
    }

    /* ── the fixed-window rate limiter ────────────────────────────────── */

    /// True when the action is allowed (and counted); false when over the
    /// limit. A blocked call is NOT counted.
    pub fn rate_allow(&self, key: &str, limit: u32, window: Duration) -> bool {
        let now = Instant::now();
        let mut map = self.rate.lock().unwrap();
        if map.len() > 10_000 {
            map.retain(|_, b| b.reset_at > now);
        }
        match map.get_mut(key) {
            Some(b) if b.reset_at > now => {
                if b.count >= limit {
                    false
                } else {
                    b.count += 1;
                    true
                }
            }
            _ => {
                map.insert(key.to_string(), RateBucket { count: 1, reset_at: now + window });
                true
            }
        }
    }

    /// The caller's best-effort IP (x-forwarded-for first hop, then
    /// x-real-ip, then "unknown").
    pub fn client_ip(headers: &axum::http::HeaderMap) -> String {
        if let Some(fwd) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            if let Some(first) = fwd.split(',').next() {
                let t = first.trim();
                if !t.is_empty() {
                    return t.to_string();
                }
            }
        }
        headers
            .get("x-real-ip")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "unknown".to_string())
    }

    /// The shared mail-send guard: 20/hour per IP, 5/hour per address.
    pub fn mail_send_allowed(&self, ip: &str, email: &str) -> bool {
        self.rate_allow(&format!("mail:ip:{ip}"), 20, Duration::from_secs(3600))
            && self.rate_allow(&format!("mail:em:{email}"), 5, Duration::from_secs(3600))
    }

    /* ── session-cache invalidation ───────────────────────────────────── */

    pub fn session_cache_drop_token(&self, token: &str) {
        self.session_cache.lock().unwrap().remove(&crate::session::token_key(token));
    }

    pub fn session_cache_drop_session(&self, session_id: &str) {
        if session_id.is_empty() {
            return;
        }
        self.session_cache
            .lock()
            .unwrap()
            .retain(|_, v| v.cs.as_ref().map(|c| c.session_id != session_id).unwrap_or(true));
    }

    pub fn session_cache_drop_user(&self, user_id: &str) {
        self.session_cache
            .lock()
            .unwrap()
            .retain(|_, v| {
                v.cs.as_ref()
                    .and_then(|c| c.user.get("id").and_then(|i| i.as_str()))
                    .map(|id| id != user_id)
                    .unwrap_or(true)
            });
    }
}

pub type St = Arc<AppState>;
