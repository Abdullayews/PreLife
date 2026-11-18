use crate::auth::{
    current_or_preview_user, current_session, err, generic, parse_body, str_field,
    App, ApiError, CurrentSession,
};
use crate::baku::{baku_instant, baku_parts, num};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};
use std::collections::HashSet;

use chrono::Datelike;

fn ok(v: Value) -> Response {
    (StatusCode::OK, Json(v)).into_response()
}
fn created(v: Value) -> Response {
    (StatusCode::CREATED, Json(v)).into_response()
}
fn bad_request() -> ApiError {
    err(StatusCode::BAD_REQUEST, "invalid")
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Micros, true)
}

/// Psych data endpoints: a REAL session when present, otherwise the V1
/// the original Next.js version (every visitor renders as signed in, so
async fn require(app: &App, headers: &HeaderMap) -> Result<CurrentSession, ApiError> {
    if let Some(cs) = current_session(&app.supa, headers).await {
        return Ok(cs);
    }
    let user = current_or_preview_user(&app.supa, headers).await.map_err(|_| generic())?;
    Ok(CurrentSession {
        session_id: "preview".into(),
        device_name: "Preview".into(),
        device_icon: "monitor".into(),
        user,
    })
}

/* ── camelCase row views ─────────────────────────────────────────────────── */

fn journal_view(r: &Value) -> Value {
    json!({
        "id": r.get("id"),
        "promptKey": r.get("prompt_key"),
        "content": r.get("content"),
        "createdAt": r.get("created_at"),
        "updatedAt": r.get("updated_at"),
    })
}

fn mood_view(r: &Value) -> Value {
    json!({
        "id": r.get("id"),
        "date": r.get("date"),
        "mood": r.get("mood"),
        "energy": r.get("energy"),
        "sleepQ": r.get("sleep_q"),
        "tags": r.get("tags"),
        "note": r.get("note"),
        "createdAt": r.get("created_at"),
        "updatedAt": r.get("updated_at"),
    })
}

fn appointment_view(r: &Value) -> Value {
    json!({
        "id": r.get("id"),
        "psychologistSlug": r.get("psychologist_slug"),
        "startAt": r.get("start_at"),
        "mode": r.get("mode"),
        "price": num(r.get("price").unwrap_or(&Value::Null)),
        "status": r.get("status"),
        "payment": r.get("payment"),
        "createdAt": r.get("created_at"),
    })
}

/* ── Journal ─────────────────────────────────────────────────────────────── */

pub async fn journal_list(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let entries = app.supa.select("journal_entries", &[
        ("select", "*"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("order", "created_at.desc"),
        ("limit", "200"),
    ]).await.map_err(|_| generic())?;
    let moods = app.supa.select("mood_logs", &[
        ("select", "date,mood,energy,sleep_q"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("order", "date.asc"),
        ("limit", "365"),
    ]).await.map_err(|_| generic())?;
    Ok(ok(json!({
        "entries": entries.iter().map(journal_view).collect::<Vec<_>>(),
        "moods": moods.iter().map(mood_view).collect::<Vec<_>>(),
    })))
}

pub async fn journal_create(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);
    let content = str_field(&body, "content").map(|s| s.trim().to_string()).unwrap_or_default();
    let prompt_key = match str_field(&body, "promptKey") {
        Some(p) if p.len() <= 80 => Value::from(p),
        _ => Value::Null,
    };
    if content.is_empty() || content.chars().count() > 4000 {
        return Err(bad_request());
    }
    let row = app.supa.insert("journal_entries", &json!({
        "user_id": user.user.id, "content": content, "prompt_key": prompt_key,
    })).await.map_err(|_| generic())?;
    Ok(created(json!({ "id": row.get("id") })))
}

pub async fn journal_delete(State(app): State<App>, headers: HeaderMap, Path(id): Path<String>) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    if id.is_empty() {
        return Err(bad_request());
    }
    let row = app.supa.select_one("journal_entries", &[("select", "id,user_id"), ("id", &format!("eq.{id}"))]).await
        .map_err(|_| generic())?;
    let row = row.filter(|r| r.get("user_id").and_then(|v| v.as_str()) == Some(user.user.id.as_str()))
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "not_found"))?;
    let row_id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default();
    app.supa.delete("journal_entries", &[("id", &format!("eq.{row_id}"))]).await
        .map_err(|_| generic())?;
    Ok(ok(json!({ "ok": true })))
}

/* ── Mood check-ins ──────────────────────────────────────────────────────── */

pub async fn mood_list(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let logs = app.supa.select("mood_logs", &[
        ("select", "*"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("order", "date.asc"),
        ("limit", "60"),
    ]).await.map_err(|_| generic())?;
    let quiz = app.supa.select("quiz_results", &[
        ("select", "id,quiz_id,score,max_score,created_at"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("order", "created_at.desc"),
        ("limit", "6"),
    ]).await.map_err(|_| generic())?;
    Ok(ok(json!({
        "logs": logs.iter().map(mood_view).collect::<Vec<_>>(),
        "quizResults": quiz.iter().map(|q| json!({
            "id": q.get("id"), "quizId": q.get("quiz_id"),
            "score": q.get("score"), "maxScore": q.get("max_score"),
            "createdAt": q.get("created_at"),
        })).collect::<Vec<_>>(),
    })))
}

pub async fn mood_upsert(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);

    let in_range = |v: Option<&Value>| -> bool {
        v.and_then(|x| x.as_i64()).map(|n| (1..=5).contains(&n)).unwrap_or(false)
    };
    if !in_range(body.get("mood")) || !in_range(body.get("energy")) || !in_range(body.get("sleepQ")) {
        return Err(bad_request());
    }
    let mood = body.get("mood").and_then(|v| v.as_i64()).unwrap_or(0);
    let energy = body.get("energy").and_then(|v| v.as_i64()).unwrap_or(0);
    let sleep_q = body.get("sleepQ").and_then(|v| v.as_i64()).unwrap_or(0);

    let mut tags: Vec<String> = Vec::new();
    if let Some(arr) = body.get("tags").and_then(|v| v.as_array()) {
        let mut seen = HashSet::new();
        for t in arr.iter().filter_map(|v| v.as_str()) {
            if t.len() <= 24 && seen.insert(t.to_string()) {
                tags.push(t.to_string());
            }
        }
        tags.truncate(5);
    }
    let note = str_field(&body, "note").map(|s| s.trim().chars().take(280).collect::<String>()).unwrap_or_default();
    let date = baku_parts(chrono::Utc::now()).date;

    let existing = app.supa.select_one("mood_logs", &[
        ("select", "id"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("date", &format!("eq.{date}")),
    ]).await.map_err(|_| generic())?;

    let payload = json!({
        "mood": mood, "energy": energy, "sleep_q": sleep_q,
        "tags": tags.join(","),
        "note": if note.is_empty() { Value::Null } else { Value::from(note) },
    });
    if existing.is_some() {
        app.supa.update("mood_logs", &[
            ("user_id", &format!("eq.{}", user.user.id)),
            ("date", &format!("eq.{date}")),
        ], &payload).await.map_err(|_| generic())?;
    } else {
        let mut p = payload;
        if let Value::Object(m) = &mut p {
            m.insert("user_id".into(), Value::from(user.user.id.clone()));
            m.insert("date".into(), Value::from(date.clone()));
        }
        app.supa.insert("mood_logs", &p).await.map_err(|_| generic())?;
    }
    Ok(ok(json!({ "ok": true, "date": date })))
}

/* ── Quizzes ─────────────────────────────────────────────────────────────── */

pub async fn quiz_submit(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);
    let quiz_id = str_field(&body, "quizId").unwrap_or_default();
    let answers_raw = body.get("answers").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    if answers_raw.is_empty() || answers_raw.len() > 6 {
        return Err(bad_request());
    }
    let quiz = app.supa.select_one("quizzes", &[("select", "code"), ("code", &format!("eq.{quiz_id}"))]).await
        .map_err(|_| generic())?;
    if quiz.is_none() {
        return Err(bad_request());
    }
    let mut answers: Vec<i64> = Vec::new();
    for a in &answers_raw {
        let n: i64 = if let Some(i) = a.as_i64() {
            i
        } else if let Some(f) = a.as_f64() {
            if f.fract() == 0.0 { f as i64 } else { return Err(bad_request()); }
        } else if let Some(sv) = a.as_str() {
            match sv.parse::<i64>() {
                Ok(v) => v,
                Err(_) => return Err(bad_request()),
            }
        } else {
            return Err(bad_request());
        };
        if !(0..=3).contains(&n) {
            return Err(bad_request());
        }
        answers.push(n);
    }
    let score: i64 = answers.iter().sum();
    let max_score = 9i64.max((answers.len() as i64) * 3);
    let row = app.supa.insert("quiz_results", &json!({
        "user_id": user.user.id,
        "quiz_id": quiz_id,
        "score": score,
        "max_score": max_score,
        "answers": Value::from(answers),
    })).await.map_err(|_| generic())?;
    Ok(created(json!({ "id": row.get("id"), "score": score, "maxScore": max_score })))
}

/* ── Bookings ────────────────────────────────────────────────────────────── */

pub async fn book_count(State(app): State<App>) -> Result<Response, ApiError> {
    let rows = app.supa.select("psychologists", &[("select", "slug")]).await
        .map_err(|_| generic())?;
    Ok(ok(json!({ "count": rows.len() })))
}

pub async fn book(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);
    let slug = str_field(&body, "slug").unwrap_or_default();
    let date = str_field(&body, "date").unwrap_or_default();
    let hour_v = body.get("hour");
    let mode = if str_field(&body, "mode").as_deref() == Some("office") { "office" } else { "online" };

    let Some(hour) = hour_v.and_then(|v| v.as_i64()).filter(|h| (0..=23).contains(h)) else {
        return Err(bad_request());
    };
    if !date.chars().enumerate().all(|(i, c)| match i {
        4 | 7 => c == '-',
        _ => c.is_ascii_digit(),
    }) || date.len() != 10 {
        return Err(bad_request());
    }

    let psy = app.supa.select_one("psychologists", &[("select", "slug,price"), ("slug", &format!("eq.{slug}"))]).await
        .map_err(|_| generic())?;
    let Some(psy) = psy else { return Err(bad_request()); };

    // The slot must fall into a weekly working block (Baku wall-clock).
    let Some(start_at) = baku_instant(&date, hour as u32) else { return Err(bad_request()); };
    if baku_parts(start_at).date != date {
        return Err(bad_request());
    }
    let weekday = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").ok()
        .map(|d| d.weekday().num_days_from_monday() + 1);
    let Some(weekday) = weekday else { return Err(bad_request()); };
    let avail = app.supa.select("psychologist_availability", &[
        ("select", "day,from_hour,to_hour"),
        ("psychologist_slug", &format!("eq.{slug}")),
    ]).await.map_err(|_| generic())?;
    let in_block = avail.iter().any(|b| {
        b.get("day").and_then(|v| v.as_i64()) == Some(weekday as i64)
            && (hour as i64) >= b.get("from_hour").and_then(|v| v.as_i64()).unwrap_or(-1)
            && (hour as i64) < b.get("to_hour").and_then(|v| v.as_i64()).unwrap_or(-1)
    });
    if !in_block {
        return Err(err(StatusCode::CONFLICT, "slot_closed"));
    }
    if start_at <= chrono::Utc::now() {
        return Err(err(StatusCode::CONFLICT, "slot_past"));
    }

    let start_iso = start_at.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    let clash = app.supa.select_one("appointments", &[
        ("select", "id"),
        ("psychologist_slug", &format!("eq.{slug}")),
        ("start_at", &format!("eq.{start_iso}")),
        ("status", "neq.cancelled"),
    ]).await.map_err(|_| generic())?;
    if clash.is_some() {
        return Err(err(StatusCode::CONFLICT, "slot_taken"));
    }
    let own = app.supa.select("appointments", &[
        ("select", "id"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("start_at", &format!("eq.{start_iso}")),
        ("status", "neq.cancelled"),
    ]).await.map_err(|_| generic())?;
    if !own.is_empty() {
        return Err(err(StatusCode::CONFLICT, "double_booked"));
    }

    let row = app.supa.insert("appointments", &json!({
        "user_id": user.user.id,
        "psychologist_slug": slug,
        "start_at": start_iso,
        "mode": mode,
        "price": psy.get("price"),
        "status": "upcoming",
        "payment": "unpaid",
    })).await.map_err(|_| generic())?;
    Ok(created(json!({ "id": row.get("id") })))
}

pub async fn cancel(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);
    let Some(id) = str_field(&body, "id").filter(|s| !s.is_empty()) else {
        return Err(bad_request());
    };
    let row = app.supa.select_one("appointments", &[("select", "*"), ("id", &format!("eq.{id}"))]).await
        .map_err(|_| generic())?;
    let row = row.filter(|r| r.get("user_id").and_then(|v| v.as_str()) == Some(user.user.id.as_str()))
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "not_found"))?;
    let start = row.get("start_at").and_then(|v| v.as_str())
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
    if let Some(start) = start {
        if start <= chrono::Utc::now() {
            return Err(err(StatusCode::CONFLICT, "already_started"));
        }
    }
    let row_id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default();
    app.supa.update("appointments", &[("id", &format!("eq.{row_id}"))], &json!({ "status": "cancelled" })).await
        .map_err(|_| generic())?;
    Ok(ok(json!({ "ok": true })))
}

pub async fn pay(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);
    let Some(id) = str_field(&body, "id").filter(|s| !s.is_empty()) else {
        return Err(bad_request());
    };
    let row = app.supa.select_one("appointments", &[("select", "id,user_id"), ("id", &format!("eq.{id}"))]).await
        .map_err(|_| generic())?;
    let row = row.filter(|r| r.get("user_id").and_then(|v| v.as_str()) == Some(user.user.id.as_str()))
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "not_found"))?;
    let row_id = row.get("id").and_then(|v| v.as_str()).unwrap_or_default();
    app.supa.update("appointments", &[("id", &format!("eq.{row_id}"))], &json!({ "payment": "paid" })).await
        .map_err(|_| generic())?;
    Ok(ok(json!({ "ok": true })))
}

/* ── Meditation media progress ───────────────────────────────────────────── */

pub async fn progress(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let body = parse_body(&bytes);
    let resource_id = str_field(&body, "resourceId").unwrap_or_default();
    let seconds = body.get("seconds").and_then(|v| v.as_f64()).unwrap_or(f64::NAN);

    let resource = app.supa.select_one("media_resources", &[
        ("select", "id,kind"), ("id", &format!("eq.{resource_id}")),
    ]).await.map_err(|_| generic())?;
    let Some(resource) = resource else { return Err(bad_request()); };
    if !seconds.is_finite() || seconds < 1.0 || seconds > 7200.0 {
        return Err(bad_request());
    }

    app.supa.insert("meditation_progress", &json!({
        "user_id": user.user.id,
        "resource_id": resource_id,
        "kind": resource.get("kind"),
        "seconds": seconds.round() as i64,
        "completed": body.get("completed").and_then(|v| v.as_bool()).unwrap_or(false),
    })).await.map_err(|_| generic())?;
    Ok(created(json!({ "ok": true })))
}

/* ── Page-facing aggregates ──────────────────────────────────────────────── */

pub async fn bookings_list(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let rows = app.supa.select("appointments", &[
        ("select", "*"),
        ("user_id", &format!("eq.{}", user.user.id)),
        ("order", "start_at.desc"),
        ("limit", "60"),
    ]).await.map_err(|_| generic())?;
    Ok(ok(json!({ "appointments": rows.iter().map(appointment_view).collect::<Vec<_>>() })))
}

pub async fn schedule_window(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let now = chrono::Utc::now();
    let from = now.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    let to = (now + chrono::Duration::days(14)).to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    let rows = app.supa.select("appointments", &[
        ("select", "user_id,psychologist_slug,start_at"),
        ("start_at", &format!("gte.{from}")),
        ("start_at", &format!("lte.{to}")),
        ("status", "neq.cancelled"),
    ]).await.map_err(|_| generic())?;

    let to_pair = |r: &Value| json!({ "startAt": r.get("start_at"), "psychologistSlug": r.get("psychologist_slug") });
    let mine: Vec<Value> = rows.iter()
        .filter(|r| r.get("user_id").and_then(|v| v.as_str()) == Some(user.user.id.as_str()))
        .map(to_pair).collect();
    let all: Vec<Value> = rows.iter().map(to_pair).collect();
    Ok(ok(json!({ "mine": mine, "all": all })))
}

pub async fn overview(State(app): State<App>, headers: HeaderMap) -> Result<Response, ApiError> {
    let user = require(&app, &headers).await?;
    let uid = user.user.id.as_str();
    let now_iso_v = now_iso();

    let logs = app.supa.select("mood_logs", &[
        ("select", "*"),
        ("user_id", &format!("eq.{uid}")),
        ("order", "date.desc"),
        ("limit", "60"),
    ]).await.map_err(|_| generic())?;

    let upcoming = app.supa.select("appointments", &[
        ("select", "*"),
        ("user_id", &format!("eq.{uid}")),
        ("status", "eq.upcoming"),
        ("start_at", &format!("gt.{now_iso_v}")),
        ("order", "start_at.asc"),
        ("limit", "3"),
    ]).await.map_err(|_| generic())?;

    let week_ago = (chrono::Utc::now() - chrono::Duration::days(7))
        .to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    let prog = app.supa.select("meditation_progress", &[
        ("select", "seconds"),
        ("user_id", &format!("eq.{uid}")),
        ("created_at", &format!("gte.{week_ago}")),
    ]).await.map_err(|_| generic())?;
    let week_seconds: i64 = prog.iter()
        .filter_map(|r| r.get("seconds").and_then(|v| v.as_i64())).sum();

    let done = app.supa.select("appointments", &[
        ("select", "id"),
        ("user_id", &format!("eq.{uid}")),
        ("status", "eq.upcoming"),
        ("start_at", &format!("lte.{now_iso_v}")),
    ]).await.map_err(|_| generic())?;

    Ok(ok(json!({
        "logs": logs.iter().map(mood_view).collect::<Vec<_>>(),
        "upcoming": upcoming.iter().map(appointment_view).collect::<Vec<_>>(),
        "weekSeconds": week_seconds,
        "doneSessions": done.len(),
    })))
}
