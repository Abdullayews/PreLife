//! /api/psych/* — ports of the psychology routes (thin wrappers over
//! the psych domain module).

use super::{json_ok, json_status, read_json};
use crate::error::{ApiError, DomainError};
use crate::session::{self, origin_from};
use crate::state::St;
use crate::util::s;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

async fn require(st: &St, headers: &HeaderMap) -> Result<crate::state::CurrentSession, DomainError> {
    session::current_session(st, headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))
}

/* ── journal ──────────────────────────────────────────────────────────── */

pub async fn journal_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::journal_list(&st, &cs.user).await?))
}

pub async fn journal_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    // Art. 9 gate: the journal is health-adjacent free text.
    if !crate::consent::consent_granted(&st, s(&cs.user, "id").as_str(), "journal").await? {
        return Err(crate::consent::consent_error("journal"));
    }
    let body = read_json(&body);
    let out = crate::psych::journal_create(&st, &cs.user, &body).await?;
    Ok(json_status(out, StatusCode::CREATED))
}

pub async fn journal_delete(
    State(st): State<St>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::journal_delete(&st, &cs.user, &id).await?))
}

/* ── mood ─────────────────────────────────────────────────────────────── */

pub async fn mood_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::mood_list(&st, &cs.user).await?))
}

pub async fn mood_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    // Art. 9 gate: mood/energy/sleep self-reports are health-adjacent.
    if !crate::consent::consent_granted(&st, s(&cs.user, "id").as_str(), "mood").await? {
        return Err(crate::consent::consent_error("mood"));
    }
    let body = read_json(&body);
    Ok(json_ok(crate::psych::mood_upsert(&st, &cs.user, &body).await?))
}

/* ── quiz ─────────────────────────────────────────────────────────────── */

pub async fn quiz_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    // Art. 9 gate: self-assessment results are health-adjacent.
    if !crate::consent::consent_granted(&st, s(&cs.user, "id").as_str(), "quiz").await? {
        return Err(crate::consent::consent_error("quiz"));
    }
    let body = read_json(&body);
    let out = crate::psych::quiz_submit(&st, &cs.user, &body).await?;
    Ok(json_status(out, StatusCode::CREATED))
}

/* ── book / cancel / pay ──────────────────────────────────────────────── */

pub async fn book_count(State(st): State<St>) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    Ok(json_ok(crate::psych::book_count(&st).await?))
}

pub async fn book_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    let out = crate::psych::book(&st, &cs.user, &body).await?;
    Ok(json_status(out, StatusCode::CREATED))
}

pub async fn cancel_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    Ok(json_ok(crate::psych::cancel(&st, &cs.user, &body).await?))
}

pub async fn pay_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    Ok(json_ok(crate::psych::pay(&st, &cs.user, &body).await?))
}

/* ── bookings / schedule-window / overview / progress ─────────────────── */

pub async fn bookings_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::bookings_list(&st, &cs.user).await?))
}

pub async fn schedule_window_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::schedule_window(&st, &cs.user).await?))
}

pub async fn overview_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::overview(&st, &cs.user).await?))
}

pub async fn progress_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    let out = crate::psych::progress(&st, &cs.user, &body).await?;
    Ok(json_status(out, StatusCode::CREATED))
}

/* ── console ──────────────────────────────────────────────────────────── */

pub async fn console_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    Ok(json_ok(crate::psych::console_list(&st, &cs.user).await?))
}

pub async fn console_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    let body = read_json(&body);
    let origin = origin_from(&st, &headers);
    Ok(json_ok(crate::psych::console_respond(&st, &cs.user, &body, &origin).await?))
}

/* ── the in-app psychology companion ──────────────────────────────────── */

pub async fn ai_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = require(&st, &headers).await?;
    // Art. 9 gate: the companion chat is health-adjacent text sent to the
    // LLM provider — the "ai" scope covers every AI feature.
    if !crate::consent::consent_granted(&st, s(&cs.user, "id").as_str(), "ai").await? {
        return Err(crate::consent::consent_error("ai"));
    }
    // The AI cost ceiling — same class as /api/ai/chat, per signed-in user.
    let uid = crate::util::s(&cs.user, "id");
    if !st.rate_allow(&format!("ai:psy:{}", uid), 10, std::time::Duration::from_secs(60)) {
        return Err(err(429, "rate_limited"));
    }
    let body = read_json(&body);
    let parsed = crate::ai::parse_chat_body(&body).map_err(|_| err(400, "invalid"))?;
    let out = crate::ai::psych_reply(&st, &parsed.history).await?;
    Ok(json_ok(serde_json::json!({ "reply": out.0, "source": out.1 })))
}
