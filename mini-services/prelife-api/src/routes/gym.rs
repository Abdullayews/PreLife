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

/* ── Set progress — the tappable set chips ────────────────────────────── */

/// GET /api/gym/progress?planId=&day=&date= → { done: { exIdx: [setNo,…] } }
pub async fn progress_get(
    State(st): State<St>,
    headers: HeaderMap,
    RawQuery(raw): RawQuery,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let q = parse_query(raw.as_deref());
    let plan_id = query_get(&q, "planId").unwrap_or("").to_string();
    let day = query_get(&q, "day").and_then(|d| d.parse::<i64>().ok()).unwrap_or(0);
    let date = query_get(&q, "date").unwrap_or("").to_string();
    if plan_id.is_empty() || !(1..=7).contains(&day) || !valid_baku_date(&date) {
        return Err(err(400, "invalid"));
    }
    let uid = s(&cs.user, "id");
    let done = crate::user_plans::progress_get(&st, &uid, &plan_id, day, &date).await;
    Ok(json_ok(serde_json::json!({ "done": done })))
}

/// POST /api/gym/progress { planId, day, date, done } — replace-semantics
/// upsert of the day's done-set map (empty map = reset).
pub async fn progress_post(
    State(st): State<St>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let body = read_json(&body);
    let plan_id = s(&body, "planId");
    let day = body.get("day").and_then(|d| d.as_i64()).unwrap_or(0);
    let date = s(&body, "date");
    if plan_id.is_empty() || !(1..=7).contains(&day) || !valid_baku_date(&date) {
        return Err(err(400, "invalid"));
    }
    let done = body.get("done").cloned().unwrap_or(json!({}));
    if !done.is_object() {
        return Err(err(400, "invalid"));
    }
    // Shape check: keys are exercise indexes, values int arrays 1..=12.
    if let Some(map) = done.as_object() {
        if map.len() > 30 {
            return Err(err(400, "invalid"));
        }
        for (k, sets) in map {
            if k.parse::<u32>().is_err() {
                return Err(err(400, "invalid"));
            }
            match sets {
                Value::Array(arr) => {
                    if arr.len() > 12 || arr.iter().any(|v| v.as_i64().map(|n| !(1..=12).contains(&n)).unwrap_or(true)) {
                        return Err(err(400, "invalid"));
                    }
                }
                _ => return Err(err(400, "invalid")),
            }
        }
    }
    let uid = s(&cs.user, "id");
    crate::user_plans::progress_save(&st, &uid, &plan_id, day, &date, &done).await?;
    Ok(json_ok(serde_json::json!({ "ok": true })))
}

/// Baku 'YYYY-MM-DD' — strict shape + a real calendar date.
fn valid_baku_date(d: &str) -> bool {
    let b = d.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    let digits = |r: std::ops::Range<usize>| b[r].iter().all(|c| c.is_ascii_digit());
    if !(digits(0..4) && digits(5..7) && digits(8..10)) {
        return false;
    }
    let y: i32 = d[0..4].parse().unwrap_or(0);
    let m: u32 = d[5..7].parse().unwrap_or(0);
    let day: u32 = d[8..10].parse().unwrap_or(0);
    (2020..=2100).contains(&y) && (1..=12).contains(&m) && (1..=31).contains(&day)
}
