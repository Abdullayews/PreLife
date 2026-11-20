//! /api/me/* + /api/devices — ports of the me and devices routes.

use super::{json_ok, read_json};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::*;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::Response;

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

async fn require(st: &St, headers: &HeaderMap) -> Result<crate::state::CurrentSession, DomainError> {
    session::current_session(st, headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))
}

/* ── /api/me/profile ──────────────────────────────────────────────────── */

pub async fn profile_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let profile = crate::profile::get_profile_view(&st, s(&cs.user, "id").as_str()).await?;
    let weights = crate::profile::weight_history(&st, s(&cs.user, "id").as_str(), 30).await;
    Ok(json_ok(serde_json::json!({
        "profile": profile,
        "weights": weights,
        "email": s(&cs.user, "email"),
    })))
}

pub async fn profile_patch(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    let uid = s(&cs.user, "id");
    let profile = crate::profile::update_profile(&st, &uid, &body).await?;
    let weights = crate::profile::weight_history(&st, &uid, 30).await;
    Ok(json_ok(serde_json::json!({
        "profile": profile,
        "weights": weights,
        "email": s(&cs.user, "email"),
    })))
}

/* ── /api/me/preferences ──────────────────────────────────────────────── */

pub async fn preferences_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::account::preferences_get(&st, s(&cs.user, "id").as_str()).await?))
}

pub async fn preferences_patch(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    Ok(json_ok(
        crate::account::preferences_update(&st, s(&cs.user, "id").as_str(), &body).await?,
    ))
}

/* ── /api/devices ─────────────────────────────────────────────────────── */

pub async fn devices_list(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::account::devices_list(&st, &cs).await?))
}

pub async fn device_patch(
    State(st): State<St>,
    Path(id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    Ok(json_ok(crate::account::device_update(&st, &cs, &id, &body).await?))
}

pub async fn device_delete(
    State(st): State<St>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::account::device_revoke(&st, &cs, &id).await?))
}
