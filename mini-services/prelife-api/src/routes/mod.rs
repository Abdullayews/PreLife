//! The router — every /api/* route the merged Next.js backend served,
//! now served by axum with identical paths, methods and response shapes.

pub mod account;
pub mod ai;
pub mod auth;
pub mod content;
pub mod emu;
pub mod gym;
pub mod internal;
pub mod psych;
pub mod subscription;

use crate::error::DomainError;
use crate::state::St;
use crate::util::*;
use axum::http::{HeaderMap, StatusCode};
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
        // subscription custom packages
        .route("/api/subscription/custom", get(subscription::custom_get).post(subscription::custom_post))
        // content catalogs
        .route("/api/content/worlds", get(content::worlds))
        .route("/api/content/gym", get(content::gym))
        .route("/api/content/diet", get(content::diet))
        .route("/api/content/meditation", get(content::meditation))
        .route("/api/content/library", get(content::library))
        .route("/api/content/subscription", get(content::subscription))
        // the local Supabase emulator (DEV only)
        .route("/api/supa-emu/rest/v1/{table}", get(emu::rest_get).post(emu::rest_post).patch(emu::rest_patch).delete(emu::rest_delete))
        .route("/api/supa-emu/auth/v1/{*action}", get(emu::auth_get).post(emu::auth_post).put(emu::auth_put).delete(emu::auth_delete))
        // server-to-server (SSR data layer)
        .route("/internal/home", get(internal::home))
        .route("/internal/config", get(internal::config))
        .with_state(st)
}
