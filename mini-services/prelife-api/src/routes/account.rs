//! /api/me/* + /api/devices — ports of the me and devices routes.

use super::{json_ok, read_json};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::*;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};

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

/* ── /api/me/consents (the data-consent gate) ─────────────────────────── */

pub async fn consents_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(serde_json::json!({
        "consents": crate::consent::consents_map(&st, s(&cs.user, "id").as_str()).await?,
    })))
}

pub async fn consents_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    let scope = s(&body, "scope");
    if !crate::consent::scope_valid(&scope) {
        return Err(err(400, "invalid_scope"));
    }
    match body.get("granted") {
        Some(serde_json::Value::Bool(granted)) => Ok(json_ok(serde_json::json!({
            "consents": crate::consent::consent_set(&st, s(&cs.user, "id").as_str(), &scope, *granted).await?,
        }))),
        _ => Err(err(400, "invalid_fields")),
    }
}

/* ── /api/me/export (access + portability) ────────────────────────────── */

pub async fn export_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let uid = s(&cs.user, "id");
    // Rate limit: the export fans out to a dozen table reads — 5/min per
    // user keeps a runaway client from hammering the database.
    if !st.rate_allow(&format!("export:{uid}"), 5, std::time::Duration::from_secs(60)) {
        return Err(err(429, "rate_limited"));
    }
    let data = crate::data_export::collect_export(&st, &cs.user).await?;
    let filename = format!("prelife-data-{}.json", crate::util::utc_date(crate::util::now_ms()));
    let body = serde_json::to_string_pretty(&data).unwrap_or_else(|_| "{}".into());
    let res = axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header("content-type", "application/json; charset=utf-8")
        .header("content-disposition", format!("attachment; filename=\"{filename}\""))
        .body(axum::body::Body::from(body));
    match res {
        Ok(res) => Ok(res),
        Err(_) => Err(DomainError::msg("export response build failed")),
    }
}

/* ── DELETE /api/me (account erasure) ─────────────────────────────────── */

pub async fn account_delete(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    if body.get("confirm") != Some(&serde_json::json!(true)) {
        return Err(crate::data_export::confirm_error());
    }

    let uid = s(&cs.user, "id");
    // Rate limit: one erasure attempt per minute per account.
    if !st.rate_allow(&format!("delete:{uid}"), 1, std::time::Duration::from_secs(60)) {
        return Err(err(429, "rate_limited"));
    }

    // Password accounts must re-verify the password — the session alone
    // must never be enough to destroy a password-protected account.
    if crate::data_export::password_capable(&st, &uid).await {
        let password = s(&body, "password");
        if password.is_empty() {
            return Err(DomainError::Api(ApiError::json(400, "password_required")));
        }
        let email = s(&cs.user, "email");
        st.supa
            .password_login(&email, &password)
            .await
            .map_err(|_| DomainError::Api(ApiError::json(400, "invalid_credentials")))?;
    }

    crate::data_export::erase_user(&st, &cs.user).await?;

    // End the (now credential-less) session cleanly: the cookie is cleared
    // with the same shape login/logout uses.
    let secure = crate::session::is_secure(st.cfg.production, &headers);
    let mut res = json_ok(serde_json::json!({ "ok": true })).into_response();
    res.headers_mut().append(
        "set-cookie",
        crate::session::cleared_session_cookie(secure).parse().unwrap(),
    );
    Ok(res)
}
