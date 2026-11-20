//! /api/content/* + /api/i18n + /api/health — the catalog routes.

use super::json_ok;
use crate::error::{ApiError, DomainError};
use crate::state::St;
use axum::extract::{RawQuery, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::json;

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

pub async fn worlds(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::content::worlds_catalog(&st).await.unwrap_or(Value::Null)))
}

pub async fn gym(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::content::gym_catalog(&st).await.unwrap_or(Value::Null)))
}

pub async fn diet(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::content::diet_catalog(&st).await.unwrap_or(Value::Null)))
}

pub async fn meditation(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::content::meditation_catalog(&st).await.unwrap_or(Value::Null)))
}

pub async fn library(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::content::library_catalog(&st).await.unwrap_or(Value::Null)))
}

pub async fn subscription(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::content::subscription_catalog(&st).await.unwrap_or(Value::Null)))
}

pub async fn i18n(State(st): State<St>, _headers: HeaderMap, RawQuery(raw): RawQuery) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let q = crate::util::parse_query(raw.as_deref());
    let locale = crate::util::query_get(&q, "locale").unwrap_or("az").to_string();
    let catalog = crate::content::i18n_catalog(&st, &locale).await?;
    Ok(json_ok(catalog))
}

pub async fn health(State(st): State<St>) -> Response {
    json_ok(json!({
        "ok": true,
        "service": "prelife",
        "version": "5.0.0",
        "uptimeSecs": st.started_at.elapsed().as_secs(),
        "supabaseConfigured": st.cfg.db_ready(),
    }))
}

use serde_json::Value;
