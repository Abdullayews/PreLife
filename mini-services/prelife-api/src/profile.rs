//! The user's own data — the profiles row plus the weight history. Port
//! of lib/server/profile.ts (the exact validation rules and the session
//! row mirroring).

use crate::error::{ApiError, DomainError};
use crate::state::St;
use crate::util::*;
use chrono::Datelike;
use serde_json::{json, Map, Value};

type Res<T> = Result<T, DomainError>;

fn v(row: &Row) -> Value {
    Value::Object(row.clone())
}

const GENDERS: &[&str] = &["male", "female", "other"];
const GOALS: &[&str] = &["lose", "maintain", "gain", "fitness"];
const ACTIVITY_LEVELS: &[&str] = &["sedentary", "light", "moderate", "active", "athlete"];
const FITNESS_LEVELS: &[&str] = &["beginner", "intermediate", "advanced"];
const THEMES: &[&str] = &["light", "dark"];
const LANGS: &[&str] = &["az", "en", "ru"];
const CONTENT_LOCATIONS: &[&str] = &["global", "az"];

const AVATAR_MAX_CHARS: usize = 500_000; // ≈ 375 KB

fn avatar_valid(s: &str) -> bool {
    // ^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$
    let Some(rest) = s.strip_prefix("data:image/") else { return false };
    let (mime, rest) = match rest.split_once(';') {
        Some(x) => x,
        None => return false,
    };
    if !matches!(mime, "png" | "jpeg" | "jpg" | "webp") {
        return false;
    }
    let Some(b64) = rest.strip_prefix("base64,") else { return false };
    !b64.is_empty() && b64.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
}

async fn latest_weight(st: &St, user_id: &str) -> (Option<f64>, Option<String>) {
    match st
        .supa
        .select_one(
            "user_weight_logs",
            &vec![
                ("select".into(), "weight_kg,log_date,created_at".into()),
                ("user_id".into(), format!("eq.{user_id}")),
                ("order".into(), "log_date.desc".into()),
            ],
        )
        .await
    {
        Ok(Some(row)) => {
            let rv = v(&row);
            (n_opt(&rv, "weight_kg"), s_opt(&rv, "log_date").or_else(|| s_opt(&rv, "created_at")))
        }
        _ => (None, None),
    }
}

pub async fn get_profile_view(st: &St, user_id: &str) -> Res<Value> {
    let row = st
        .supa
        .select_one("profiles", &vec![("select".into(), "*".into()), ("id".into(), format!("eq.{user_id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let rv = row.map(|r| v(&r)).unwrap_or(json!({}));
    let (weight_kg, weight_at) = latest_weight(st, user_id).await;
    Ok(json!({
        "name": s_opt(&rv, "full_name").map(Value::String).unwrap_or(Value::Null),
        "avatarUrl": s_opt(&rv, "avatar_url").map(Value::String).unwrap_or(Value::Null),
        "lang": s_opt(&rv, "lang").unwrap_or_else(|| "en".into()),
        "theme": s_opt(&rv, "theme").unwrap_or_else(|| "light".into()),
        "contentLocation": if s(&rv, "content_location") == "az" { "az" } else { "global" },
        "railFolded": is_true(&rv, "rail_folded"),
        "gender": s_opt(&rv, "gender").map(Value::String).unwrap_or(Value::Null),
        "birthYear": i64_opt(&rv, "birth_year").map(|n| json!(n)).unwrap_or(Value::Null),
        "heightCm": n_opt(&rv, "height_cm").map(|n| json!(n)).unwrap_or(Value::Null),
        "goal": s_opt(&rv, "goal").map(Value::String).unwrap_or(Value::Null),
        "activityLevel": s_opt(&rv, "activity_level").map(Value::String).unwrap_or(Value::Null),
        "fitnessLevel": s_opt(&rv, "fitness_level").map(Value::String).unwrap_or(Value::Null),
        "workoutsPerWeek": i64_opt(&rv, "workouts_per_week").map(|n| json!(n)).unwrap_or(Value::Null),
        "planOnboardingDone": is_true(&rv, "plan_onboarding_done"),
        "weightKg": weight_kg.map(|n| json!(n)).unwrap_or(Value::Null),
        "weightUpdatedAt": weight_at.map(Value::String).unwrap_or(Value::Null),
        "updatedAt": s_opt(&rv, "updated_at").map(Value::String).unwrap_or(Value::Null),
    }))
}

/// A compact one-line profile summary for the AI context prompt.
pub async fn profile_summary_line(st: &St, user_id: &str) -> String {
    match get_profile_view(st, user_id).await {
        Ok(p) => {
            let mut parts: Vec<String> = Vec::new();
            if let Some(w) = p.get("weightKg").and_then(|v| v.as_f64()) {
                parts.push(format!("{} kg", crate::mail::format_price(w)));
            }
            if let Some(h) = p.get("heightCm").and_then(|v| v.as_f64()) {
                parts.push(format!("{} cm", crate::mail::format_price(h)));
            }
            if let Some(g) = p.get("goal").and_then(|v| v.as_str()) {
                parts.push(format!("goal: {g}"));
            }
            if let Some(a) = p.get("activityLevel").and_then(|v| v.as_str()) {
                parts.push(format!("activity: {a}"));
            }
            if let Some(f) = p.get("fitnessLevel").and_then(|v| v.as_str()) {
                parts.push(format!("level: {f}"));
            }
            if let Some(w) = p.get("workoutsPerWeek").and_then(|v| v.as_i64()) {
                parts.push(format!("{}×/week", w));
            }
            let scope = if p.get("contentLocation") == Some(&json!("az")) {
                "; content scope: Azerbaijan only"
            } else {
                "; content scope: global"
            };
            format!("{}{}", if parts.is_empty() { "not filled in yet".to_string() } else { parts.join(", ") }, scope)
        }
        Err(_) => "unavailable".to_string(),
    }
}

fn has(body: &Value, key: &str) -> bool {
    body.get(key).is_some()
}

fn one_of(list: &[&str], v: Option<&str>) -> Option<String> {
    v.and_then(|s| list.iter().find(|l| **l == s).map(|l| l.to_string()))
}

fn num_of(body: &Value, key: &str) -> Option<f64> {
    match body.get(key) {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

/// Validate + apply a partial profile update. Errors as Api with the
/// first bad field name (the ApiCode contract).
pub async fn update_profile(st: &St, user_id: &str, body: &Value) -> Res<Value> {
    let mut patch = Map::new();
    let mut errors: Vec<String> = Vec::new();

    if let Some(name) = body.get("name") {
        match name {
            Value::String(n) => {
                let n = n.trim();
                if n.is_empty() || char_len(n) > 100 {
                    errors.push("name".into());
                } else {
                    patch.insert("full_name".into(), json!(n));
                }
            }
            _ => errors.push("name".into()),
        }
    }
    match body.get("avatarUrl") {
        Some(Value::Null) => {
            patch.insert("avatar_url".into(), Value::Null);
        }
        Some(Value::String(s)) if s.is_empty() => {
            patch.insert("avatar_url".into(), Value::Null);
        }
        Some(Value::String(s)) => {
            if avatar_valid(s) && s.len() <= AVATAR_MAX_CHARS {
                patch.insert("avatar_url".into(), json!(s));
            } else {
                errors.push("avatarUrl".into());
            }
        }
        Some(_) => errors.push("avatarUrl".into()),
        None => {}
    }
    if let Some(g) = body.get("gender") {
        match one_of(GENDERS, g.as_str()) {
            Some(x) => {
                patch.insert("gender".into(), json!(x));
            }
            None => errors.push("gender".into()),
        }
    }
    if has(body, "birthYear") {
        match num_of(body, "birthYear") {
            Some(n) if n.fract() == 0.0 && (1900.0..=chrono::Utc::now().year() as f64).contains(&n) => {
                patch.insert("birth_year".into(), json!(n as i64));
            }
            _ => errors.push("birthYear".into()),
        }
    }
    if has(body, "heightCm") {
        match num_of(body, "heightCm") {
            Some(n) if (80.0..=260.0).contains(&n) => {
                patch.insert("height_cm".into(), json!(n.round()));
            }
            _ => errors.push("heightCm".into()),
        }
    }
    if let Some(g) = body.get("goal") {
        match one_of(GOALS, g.as_str()) {
            Some(x) => {
                patch.insert("goal".into(), json!(x));
            }
            None => errors.push("goal".into()),
        }
    }
    if let Some(a) = body.get("activityLevel") {
        match one_of(ACTIVITY_LEVELS, a.as_str()) {
            Some(x) => {
                patch.insert("activity_level".into(), json!(x));
            }
            None => errors.push("activityLevel".into()),
        }
    }
    if let Some(f) = body.get("fitnessLevel") {
        match one_of(FITNESS_LEVELS, f.as_str()) {
            Some(x) => {
                patch.insert("fitness_level".into(), json!(x));
            }
            None => errors.push("fitnessLevel".into()),
        }
    }
    if has(body, "workoutsPerWeek") {
        match num_of(body, "workoutsPerWeek") {
            Some(n) if n.fract() == 0.0 && (0.0..=14.0).contains(&n) => {
                patch.insert("workouts_per_week".into(), json!(n as i64));
            }
            _ => errors.push("workoutsPerWeek".into()),
        }
    }
    if let Some(t) = body.get("theme") {
        match one_of(THEMES, t.as_str()) {
            Some(x) => {
                patch.insert("theme".into(), json!(x));
            }
            None => errors.push("theme".into()),
        }
    }
    if let Some(l) = body.get("lang") {
        match one_of(LANGS, l.as_str()) {
            Some(x) => {
                patch.insert("lang".into(), json!(x));
            }
            None => errors.push("lang".into()),
        }
    }
    if let Some(c) = body.get("contentLocation") {
        match one_of(CONTENT_LOCATIONS, c.as_str()) {
            Some(x) => {
                patch.insert("content_location".into(), json!(x));
            }
            None => errors.push("contentLocation".into()),
        }
    }
    match body.get("railFolded") {
        Some(Value::Bool(b)) => {
            patch.insert("rail_folded".into(), json!(b));
        }
        Some(_) => errors.push("railFolded".into()),
        None => {}
    }
    match body.get("planOnboardingDone") {
        Some(Value::Bool(b)) => {
            patch.insert("plan_onboarding_done".into(), json!(b));
        }
        Some(_) => errors.push("planOnboardingDone".into()),
        None => {}
    }

    if let Some(first) = errors.first() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, first)));
    }

    // Weight goes to the log table BEFORE the nothing-to-update check.
    if has(body, "weightKg") {
        let w = num_of(body, "weightKg");
        match w {
            Some(n) if (20.0..=400.0).contains(&n) => {
                let today = utc_date(now_ms());
                // Serialize check-then-insert — no duplicate rows per date.
                let _guard = st.write_lock.lock().await;
                let existing = st
                    .supa
                    .select_one(
                        "user_weight_logs",
                        &vec![
                            ("select".into(), "id".into()),
                            ("user_id".into(), format!("eq.{user_id}")),
                            ("log_date".into(), format!("eq.{today}")),
                        ],
                    )
                    .await;
                match existing {
                    Ok(Some(row)) if !s(&v(&row), "id").is_empty() => {
                        st.supa
                            .update("user_weight_logs", &vec![("id".into(), format!("eq.{}", s(&v(&row), "id")))], &json!({ "weight_kg": n }))
                            .await
                            .map_err(DomainError::from_supa)?;
                    }
                    _ => {
                        st.supa
                            .insert("user_weight_logs", &json!({ "user_id": user_id, "log_date": today, "weight_kg": n }))
                            .await
                            .map_err(DomainError::from_supa)?;
                    }
                }
            }
            _ => return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "weightKg"))),
        }
    }

    if patch.is_empty() {
        if has(body, "weightKg") {
            return get_profile_view(st, user_id).await;
        }
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "nothing_to_update")));
    }

    let full_name = patch.get("full_name").and_then(|v| v.as_str()).map(String::from);
    let has_avatar = patch.contains_key("avatar_url");
    let avatar_val = patch.get("avatar_url").cloned().unwrap_or(Value::Null);
    let rail = patch.get("rail_folded").and_then(|v| v.as_bool());
    let content_location = patch.get("content_location").and_then(|v| v.as_str()).map(String::from);

    st.supa
        .update("profiles", &vec![("id".into(), format!("eq.{user_id}"))], &Value::Object(patch))
        .await
        .map_err(DomainError::from_supa)?;

    st.session_cache_drop_user(user_id);
    crate::account::prefs_cache_drop(st, user_id);

    // Mirror identity + preference changes onto the session rows.
    let mut session_patch = Map::new();
    if let Some(name) = full_name {
        session_patch.insert("user_name".into(), json!(name));
    }
    if has_avatar {
        session_patch.insert("user_avatar".into(), avatar_val);
    }
    if let Some(rail) = rail {
        session_patch.insert("user_folded".into(), json!(rail));
    }
    if let Some(loc) = content_location {
        session_patch.insert("user_location".into(), json!(loc));
    }
    if !session_patch.is_empty() {
        let _ = st
            .supa
            .update("sessions", &vec![("user_id".into(), format!("eq.{user_id}"))], &Value::Object(session_patch))
            .await;
    }

    get_profile_view(st, user_id).await
}

/// The user's weight history (newest first) for the profile page chart.
pub async fn weight_history(st: &St, user_id: &str, limit: usize) -> Vec<Value> {
    match st
        .supa
        .select(
            "user_weight_logs",
            &vec![
                ("select".into(), "log_date,weight_kg".into()),
                ("user_id".into(), format!("eq.{user_id}")),
                ("order".into(), "log_date.desc".into()),
                ("limit".into(), limit.to_string()),
            ],
        )
        .await
    {
        Ok(rows) => rows
            .iter()
            .filter_map(|r| {
                let rv = v(r);
                match (s_opt(&rv, "log_date"), n_opt(&rv, "weight_kg")) {
                    (Some(d), Some(w)) => Some(json!({ "logDate": d, "weightKg": w })),
                    _ => None,
                }
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}
