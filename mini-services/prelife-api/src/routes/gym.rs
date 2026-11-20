//! /api/gym/plan — the user's active workout plan (the questionnaire
//! flow). Port of the gym/plan route.

use super::{json_ok, read_json};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::*;
use axum::body::Bytes;
use axum::extract::{RawQuery, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::{json, Value};

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

fn norm_locale(v: Option<&str>) -> String {
    match v {
        Some("en") => "en".into(),
        Some("ru") => "ru".into(),
        _ => "az".into(),
    }
}

pub async fn plan_get(State(st): State<St>, headers: HeaderMap, RawQuery(raw): RawQuery) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let q = parse_query(raw.as_deref());
    let locale = norm_locale(query_get(&q, "locale"));
    let uid = s(&cs.user, "id");
    let plan = crate::user_plans::ensure_default_plan(&st, &uid, &locale).await;
    let profile = crate::profile::get_profile_view(&st, &uid).await?;
    Ok(json_ok(serde_json::json!({
        "plan": plan,
        "onboardingDone": profile.get("planOnboardingDone").cloned().unwrap_or(Value::Bool(false)),
    })))
}

pub async fn plan_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let body = read_json(&body);
    let locale = norm_locale(body.get("locale").and_then(|l| l.as_str()));
    let answers = body.get("answers").cloned().unwrap_or(json!({}));
    if !answers.is_object() || answers.as_object().map(|o| o.is_empty()).unwrap_or(true) {
        return Err(err(400, "invalid"));
    }
    // The AI cost ceiling — plan generation calls Gemini, same class as
    // /api/ai/chat: 10/min per signed-in user.
    let uid = s(&cs.user, "id");
    if !st.rate_allow(&format!("ai:plan:{}", uid), 10, std::time::Duration::from_secs(60)) {
        return Err(err(429, "rate_limited"));
    }
    // The raw answers go into the model prompt — bound them so a huge body
    // can't blow up the request cost.
    if serde_json::to_string(&answers).map(|s| s.len() > 4096).unwrap_or(true) {
        return Err(err(400, "invalid"));
    }
    let (plan, source) = crate::user_plans::generate_plan(&st, &uid, &answers, &locale).await?;
    let _ = crate::profile::update_profile(&st, &uid, &json!({ "planOnboardingDone": true })).await;
    Ok(json_ok(serde_json::json!({ "plan": plan, "source": source, "onboardingDone": true })))
}

pub async fn plan_delete(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let uid = s(&cs.user, "id");
    crate::user_plans::reset_plans(&st, &uid).await;
    let _ = crate::profile::update_profile(&st, &uid, &json!({ "planOnboardingDone": false })).await;
    let plan = crate::user_plans::get_active_plan(&st, &uid).await;
    Ok(json_ok(serde_json::json!({ "ok": true, "plan": plan })))
}
