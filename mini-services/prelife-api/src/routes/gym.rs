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
use serde_json::{json, Map, Value};

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

/* ── the hall manager's console (v5.4 role system) ────────────────────── */

/// A filter value for eq. — numbers without quotes, strings verbatim.
/// (The emu's content ids are JSON numbers; production ids may be uuids —
/// `s()` only reads strings, so the raw JSON value is stringified here.)
fn eq_val(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

/// v5.4: the hall a hall-manager account owns — resolved from the OWNERSHIP
/// LINK (gym_places.owner_id), never from a client-supplied slug, so every
/// action is scoped to the manager's own hall by construction.
async fn owned_hall(st: &St, uid: &str) -> Result<Option<Value>, DomainError> {
    let params = vec![
        ("select".to_string(), "*".to_string()),
        ("owner_id".to_string(), format!("eq.{uid}")),
    ];
    let row = st
        .supa
        .select_one("gym_places", &params)
        .await
        .map_err(DomainError::from_supa)?;
    Ok(row.map(Value::Object))
}

/// The full console payload (hall + trainer roster + spec registry).
async fn console_payload(st: &St, uid: &str) -> Result<Value, DomainError> {
    let hall = owned_hall(st, uid)
        .await?
        .ok_or_else(|| err(403, "forbidden"))?;
    let hall_id = eq_val(hall.get("id").unwrap_or(&Value::Null));
    if hall_id.is_empty() {
        return Err(err(500, "invalid"));
    }

    let trainer_params: Vec<(String, String)> = vec![
        ("select".into(), "id,name,spec_code,years".into()),
        ("gym_place_id".into(), format!("eq.{hall_id}")),
        ("order".into(), "sort_order.asc".into()),
    ];
    let trainers = st
        .supa
        .select("gym_trainers", &trainer_params)
        .await
        .map_err(DomainError::from_supa)?;
    let trainers: Vec<Value> = trainers
        .iter()
        .map(|r| {
            let rv = Value::Object(r.clone());
            json!({
                "id": s(&rv, "id"),
                "name": s(&rv, "name"),
                "specCode": s(&rv, "spec_code"),
                "years": rv.get("years").and_then(|v| v.as_i64()).unwrap_or(0),
            })
        })
        .collect();

    let spec_params: Vec<(String, String)> = vec![
        ("select".into(), "code".into()),
        ("order".into(), "sort_order.asc".into()),
    ];
    let specs = st
        .supa
        .select("gym_trainer_specs", &spec_params)
        .await
        .map_err(DomainError::from_supa)?;
    let specs: Vec<Value> = specs
        .iter()
        .map(|r| json!({ "code": s(&Value::Object(r.clone()), "code") }))
        .collect();

    Ok(json!({
        "hall": {
            "id": hall_id,
            "slug": s(&hall, "slug"),
            "ns": s(&hall, "ns"),
            "nameKey": s(&hall, "name_key"),
            "image": s(&hall, "image_url"),
            "rating": hall.get("rating").cloned().unwrap_or(Value::Null),
            "address": s(&hall, "address"),
            "hours": s(&hall, "hours"),
            "dayPrice": hall.get("day_price").cloned().unwrap_or(Value::Null),
            "welcomeVisible": is_true(&hall, "welcome_visible"),
        },
        "trainers": trainers,
        "specs": specs,
    }))
}

/// GET /api/gym/console — the manager's own hall + roster. The role check
/// rides the session; the payload comes from the ownership link, so a
/// stale/missing link degrades to a clean 403 (not an empty editor).
pub async fn console_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    if s(&cs.user, "role") != "hall_manager" {
        return Err(err(403, "forbidden"));
    }
    Ok(json_ok(console_payload(&st, &s(&cs.user, "id")).await?))
}

/// POST /api/gym/console — the console's actions. Every action re-resolves
/// the owned hall first (ownership = authority), validates its inputs
/// strictly and answers with the fresh payload.
pub async fn console_post(
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
    let uid = s(&cs.user, "id");
    if s(&cs.user, "role") != "hall_manager" {
        return Err(err(403, "forbidden"));
    }
    // Cheap DB actions, but still a write surface — 30/min per manager is
    // generous for a human and useless for a script.
    if !st.rate_allow(&format!("hall:console:{uid}"), 30, std::time::Duration::from_secs(60)) {
        return Err(err(429, "rate_limited"));
    }
    let body = read_json(&body);
    let action = s(&body, "action");

    // The owned hall must exist for every action (update/add/remove all
    // target it) — resolving it first keeps the handlers below link-safe.
    let hall = owned_hall(&st, &uid).await?.ok_or_else(|| err(403, "forbidden"))?;
    // The hall id as the DB sees it (a number in the emu's seeded content,
    // a uuid in production) — kept as a raw JSON value for inserts and
    // stringified for eq. filters.
    let hall_id_val = hall.get("id").cloned().unwrap_or(Value::Null);
    let hall_id = eq_val(&hall_id_val);
    if hall_id.is_empty() {
        return Err(err(500, "invalid"));
    }

    match action.as_str() {
        "update" => {
            let mut patch = Map::new();
            if let Some(h) = body.get("hours") {
                match h {
                    Value::String(v) => {
                        let v = v.trim();
                        if v.is_empty() || char_len(v) > 60 {
                            return Err(err(400, "invalid"));
                        }
                        patch.insert("hours".into(), json!(v));
                    }
                    _ => return Err(err(400, "invalid")),
                }
            }
            if let Some(p) = body.get("dayPrice") {
                // gym_places.day_price is NOT NULL — the field is a number
                // (0 allowed: "free entry" days), never a null/unset.
                match p {
                    Value::Number(n) => {
                        let f = n.as_f64().unwrap_or(f64::NAN);
                        if !f.is_finite() || !(0.0..=100_000.0).contains(&f) {
                            return Err(err(400, "invalid"));
                        }
                        patch.insert("day_price".into(), json!((f * 100.0).round() / 100.0));
                    }
                    _ => return Err(err(400, "invalid")),
                }
            }
            if let Some(a) = body.get("address") {
                match a {
                    Value::String(v) => {
                        let v = v.trim();
                        if v.is_empty() || char_len(v) > 160 {
                            return Err(err(400, "invalid"));
                        }
                        patch.insert("address".into(), json!(v));
                    }
                    _ => return Err(err(400, "invalid")),
                }
            }
            if let Some(w) = body.get("welcomeVisible") {
                match w {
                    Value::Bool(b) => { patch.insert("welcome_visible".into(), json!(b)); }
                    _ => return Err(err(400, "invalid")),
                }
            }
            if patch.is_empty() {
                return Err(err(400, "invalid"));
            }
            st.supa
                .update(
                    "gym_places",
                    &vec![("id".to_string(), format!("eq.{hall_id}"))],
                    &Value::Object(patch),
                )
                .await
                .map_err(DomainError::from_supa)?;
        }
        "add_trainer" => {
            let name = match body.get("name") {
                Some(Value::String(v)) => v.trim().to_string(),
                _ => return Err(err(400, "invalid")),
            };
            // Same charset gate as account names — the trainer name is
            // echoed on every public gym page.
            if name.is_empty() || char_len(&name) > 80 || !crate::util::name_chars_ok(&name) {
                return Err(err(400, "invalid"));
            }
            let spec = s(&body, "specCode");
            if spec.is_empty() || char_len(&spec) > 40 {
                return Err(err(400, "invalid"));
            }
            // The spec must exist in the registry (no free-text codes).
            let spec_row = st
                .supa
                .select_one(
                    "gym_trainer_specs",
                    &vec![("select".to_string(), "code".to_string()), ("code".to_string(), format!("eq.{spec}"))],
                )
                .await
                .map_err(DomainError::from_supa)?;
            if spec_row.is_none() {
                return Err(err(400, "invalid"));
            }
            let years = match body.get("years") {
                Some(Value::Number(n)) if n.is_u64() => n.as_u64().unwrap_or(u64::MAX),
                _ => return Err(err(400, "invalid")),
            };
            if years > 60 {
                return Err(err(400, "invalid"));
            }
            // Roster cap — a hall's trainer list is a curated card, not a
            // free-for-all table.
            let existing = st
                .supa
                .select(
                    "gym_trainers",
                    &vec![
                        ("select".to_string(), "id,sort_order".to_string()),
                        ("gym_place_id".to_string(), format!("eq.{hall_id}")),
                    ],
                )
                .await
                .map_err(DomainError::from_supa)?;
            if existing.len() >= 20 {
                return Err(err(400, "invalid"));
            }
            let next_sort = existing
                .iter()
                .map(|r| Value::Object(r.clone()).get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0))
                .max()
                .unwrap_or(0)
                + 1;
            st.supa
                .insert(
                    "gym_trainers",
                    &json!({
                        "gym_place_id": hall_id_val,
                        "name": name,
                        "spec_code": spec,
                        "years": years,
                        "sort_order": next_sort,
                    }),
                )
                .await
                .map_err(DomainError::from_supa)?;
        }
        "remove_trainer" => {
            let trainer_id = s(&body, "trainerId");
            if trainer_id.is_empty() || char_len(&trainer_id) > 64 {
                return Err(err(400, "invalid"));
            }
            // The delete is filtered by BOTH the trainer id AND the owned
            // hall — a foreign trainer id can simply never match.
            st.supa
                .delete(
                    "gym_trainers",
                    &vec![
                        ("id".to_string(), format!("eq.{trainer_id}")),
                        ("gym_place_id".to_string(), format!("eq.{hall_id}")),
                    ],
                )
                .await
                .map_err(DomainError::from_supa)?;
        }
        _ => return Err(err(400, "invalid")),
    }

    Ok(json_ok(console_payload(&st, &uid).await?))
}
