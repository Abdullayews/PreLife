//! The router — every /api/* route the merged Next.js backend served,
//! now served by axum with identical paths, methods and response shapes.

pub mod account;
pub mod admin;
pub mod ai;
pub mod auth;
pub mod content;
pub mod emu;
pub mod gym;
pub mod internal;
pub mod psych;
pub mod shelf;
pub mod subscription;

use crate::state::St;
use axum::extract::Request;
use axum::http::{HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde_json::Value;

/* ── shared route plumbing ────────────────────────────────────────────── */

/// The JSON body of a request ({} on any parse error — readJson).
pub fn read_json(body: &[u8]) -> Value {
    serde_json::from_slice::<Value>(body)
        .ok()
        .filter(|v| v.is_object())
        .unwrap_or_else(|| serde_json::json!({}))
}

pub fn json_ok(v: Value) -> Response {
    Json(v).into_response()
}

pub fn json_status(v: Value, status: StatusCode) -> Response {
    (status, Json(v)).into_response()
}

/* ── assembly ─────────────────────────────────────────────────────────── */

/// v5.2 (loop iter 3, security round): baseline security headers on every
/// response. The API is JSON (nosniff is the load-bearing one), the emu
/// consent page is HTML — both refuse framing (the app preview iframes the
/// FRONTEND on :3000, never these API surfaces), leak no referrer, and
/// dynamic data must not sit in any intermediary cache.
async fn security_headers(req: Request, next: Next) -> Response {
    let mut res = next.run(req).await;
    let h = res.headers_mut();
    h.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    h.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    h.insert("x-frame-options", HeaderValue::from_static("DENY"));
    h.insert("cache-control", HeaderValue::from_static("no-store"));
    res
}

/// v5.2 (security round 2): CSRF defense-in-depth for state-changing /api/*
/// calls. SameSite=Lax on pl_session already stops cross-site cookie
/// attachment; this layer additionally rejects the request when a browser
/// attached a **foreign Origin** to an unsafe method. Same-origin posts
/// match the request host; non-browser callers (the SSR layer, curl — no
/// Origin header at all) pass untouched, so server-to-server flows and the
/// sandbox dev rewrite (Origin localhost vs rewritten Host 127.0.0.1) keep
/// working via the loopback allowance.
async fn origin_guard(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let is_unsafe = matches!(
        method,
        axum::http::Method::POST | axum::http::Method::PUT | axum::http::Method::PATCH | axum::http::Method::DELETE
    );
    if is_unsafe && (path.starts_with("/api/") || path.starts_with("/internal/")) {
        let h = req.headers();
        if let Some(origin) = h.get("origin").and_then(|v| v.to_str().ok()) {
            let origin_host = crate::util::origin_host(origin);
            let req_host = h
                .get("x-forwarded-host")
                .or_else(|| h.get("host"))
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .split(':')
                .next()
                .unwrap_or("");
            let same_host = origin_host.as_deref() == Some(req_host);
            // Loopback origins are trusted: the dev rewrite proxies browser
            // posts to 127.0.0.1:3030 with the original localhost Origin,
            // and only machine-local processes can own a loopback origin.
            let loopback = matches!(origin_host.as_deref(), Some("localhost") | Some("127.0.0.1") | Some("[::1]"));
            // "null"/opaque Origins (the emu consent page submits one after
            // its redirect-charged navigation) pass only when the browser
            // itself asserts same-originness via the forbidden-to-set
            // Sec-Fetch-Site header — a cross-site attacker page can never
            // produce that combination.
            let null_ok = origin_host.is_none()
                && h.get("sec-fetch-site").and_then(|v| v.to_str().ok()) == Some("same-origin");
            if !(same_host || loopback || null_ok) {
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({ "error": "bad_origin" })),
                )
                    .into_response();
            }
        }
    }
    next.run(req).await
}

pub fn router(st: St) -> Router {
    Router::new()
        // health + i18n
        .route("/api/health", get(content::health))
        .route("/api/i18n", get(content::i18n))
        // auth
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/signup", post(auth::signup))
        .route("/api/auth/resend", post(auth::resend))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/complete", post(auth::complete))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/verify", get(auth::verify))
        .route("/api/auth/callback", get(auth::callback))
        .route("/api/auth/oauth/{provider}", get(auth::oauth_start))
        // me + devices
        .route("/api/me/profile", get(account::profile_get).patch(account::profile_patch))
        .route("/api/me/preferences", get(account::preferences_get).patch(account::preferences_patch))
        .route("/api/me/consents", get(account::consents_get).post(account::consents_post))
        .route("/api/me/export", get(account::export_get))
        .route("/api/me", delete(account::account_delete))
        .route("/api/devices", get(account::devices_list))
        .route("/api/devices/{id}", axum::routing::patch(account::device_patch).delete(account::device_delete))
        // psych
        .route("/api/psych/journal", get(psych::journal_get).post(psych::journal_post))
        .route("/api/psych/journal/{id}", delete(psych::journal_delete))
        .route("/api/psych/mood", get(psych::mood_get).post(psych::mood_post))
        .route("/api/psych/quiz", post(psych::quiz_post))
        .route("/api/psych/book", get(psych::book_count).post(psych::book_post))
        .route("/api/psych/cancel", post(psych::cancel_post))
        .route("/api/psych/pay", post(psych::pay_post))
        .route("/api/psych/bookings", get(psych::bookings_get))
        .route("/api/psych/schedule-window", get(psych::schedule_window_get))
        .route("/api/psych/overview", get(psych::overview_get))
        .route("/api/psych/progress", post(psych::progress_post))
        .route("/api/psych/console", get(psych::console_get).post(psych::console_post))
        .route("/api/psych/ai", post(psych::ai_post))
        // ai chat (public)
        .route("/api/ai/chat", post(ai::chat_post))
        // gym plan
        .route("/api/gym/plan", get(gym::plan_get).post(gym::plan_post).delete(gym::plan_delete))
        .route("/api/gym/progress", get(gym::progress_get).post(gym::progress_post))
        // hall manager console (v5.4 role system)
        .route("/api/gym/console", get(gym::console_get).post(gym::console_post))
        // administrator console (v5.4 role system)
        .route("/api/admin/console", get(admin::console_get))
        // library bookshelf
        .route("/api/library/shelf", get(shelf::shelf_get).post(shelf::shelf_post))
        .route("/api/library/shelf/{slug}", delete(shelf::shelf_delete))
        // subscription custom packages
        .route("/api/subscription/custom", get(subscription::custom_get).post(subscription::custom_post))
        // content catalogs
        .route("/api/content/worlds", get(content::worlds))
        .route("/api/content/gym", get(content::gym))
        .route("/api/content/diet", get(content::diet))
        .route("/api/content/meditation", get(content::meditation))
        .route("/api/content/library", get(content::library))
        .route("/api/content/subscription", get(content::subscription))
        // the local Supabase emulator (DEV only) — v5.2 (security round 2):
        // the browser-facing surface is the OAuth consent page only.
        // The REST mirror and GoTrue admin/token routes were REMOVED from
        // the HTTP surface (in-process callers use EmuStore directly);
        // serving them unauthenticated meant full-DB read/write + admin
        // user forgery + session-table account takeover.
        .route("/api/supa-emu/auth/v1/{*action}", get(emu::auth_get).post(emu::auth_post))
        // server-to-server (SSR data layer)
        .route("/internal/home", get(internal::home))
        .route("/internal/config", get(internal::config))
        .layer(axum::extract::DefaultBodyLimit::max(1_048_576)) // v5.2 sec: 1 MiB cap — no unbounded body reads
        .layer(axum::middleware::from_fn(origin_guard))
        .layer(axum::middleware::from_fn(security_headers))
        .with_state(st)
}
