//! /api/subscription/custom — custom package requests.

use super::{json_ok, json_status, read_json};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::*;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

pub async fn custom_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let packages = crate::packages::list_custom_packages(&st, s(&cs.user, "id").as_str()).await;
    Ok(json_ok(serde_json::json!({ "packages": packages })))
}

pub async fn custom_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let body = read_json(&body);
    let pkg = crate::packages::create_custom_package(
        &st,
        s(&cs.user, "id").as_str(),
        body.get("features").unwrap_or(&serde_json::Value::Null),
        body.get("months").unwrap_or(&serde_json::Value::Null),
    )
    .await?;
    Ok(json_status(serde_json::json!({ "package": pkg }), StatusCode::CREATED))
}
