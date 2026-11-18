mod ai;
mod auth;
mod baku;
mod cache;
mod config;
mod content;
mod psych;
mod supabase;

use auth::AppState;
use axum::routing::{delete, get, patch, post};
use axum::Router;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    let cfg = config::Config::load();
    if cfg.supabase_url.is_empty() || cfg.supabase_key.is_empty() {
        eprintln!("FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (check .env)");
        std::process::exit(1);
    }
    let port = cfg.port;

    let state = Arc::new(AppState {
        supa: supabase::Supa::new(&cfg.supabase_url, &cfg.supabase_key),
        cache: cache::TtlCache::new(60),
        zai: cfg.zai,
        started: std::time::Instant::now(),
    });

    let app = Router::new()
        // health + i18n + content
        .route("/api/health", get(content::health))
        .route("/api/i18n", get(content::i18n))
        .route("/api/content/worlds", get(content::worlds))
        .route("/api/content/gym", get(content::gym))
        .route("/api/content/diet", get(content::diet))
        .route("/api/content/meditation", get(content::meditation))
        .route("/api/content/library", get(content::library))
        .route("/api/content/subscription", get(content::subscription))
        // auth
        .route("/api/auth/signup", post(auth::signup))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        // devices
        .route("/api/devices", get(auth::devices_list))
        .route("/api/devices/{id}", patch(auth::device_update).delete(auth::device_revoke))
        // psychology — journal
        .route("/api/psych/journal", get(psych::journal_list).post(psych::journal_create))
        .route("/api/psych/journal/{id}", delete(psych::journal_delete))
        // psychology — mood
        .route("/api/psych/mood", get(psych::mood_list).post(psych::mood_upsert))
        // psychology — quiz
        .route("/api/psych/quiz", post(psych::quiz_submit))
        // psychology — booking
        .route("/api/psych/book", get(psych::book_count).post(psych::book))
        .route("/api/psych/cancel", post(psych::cancel))
        .route("/api/psych/pay", post(psych::pay))
        // psychology — media progress
        .route("/api/psych/progress", post(psych::progress))
        // psychology — page aggregates
        .route("/api/psych/bookings", get(psych::bookings_list))
        .route("/api/psych/schedule-window", get(psych::schedule_window))
        .route("/api/psych/overview", get(psych::overview))
        // AI
        .route("/api/ai/chat", post(ai::chat))
        .route("/api/psych/ai", post(ai::psych_chat))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.expect("bind failed");
    println!("prelife-api v{} listening on {addr}", env!("CARGO_PKG_VERSION"));
    axum::serve(listener, app).await.expect("server error");
}
