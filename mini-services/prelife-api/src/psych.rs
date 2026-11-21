//! Psychology-section data — the port of lib/server/psych-data.ts. Every
//! function receives the REAL session user; errors are Api (the ApiCode
//! path) or Msg (transport failures the routes 500).

use crate::error::{ApiError, DomainError};
use crate::mail::{build_payment_due_mail, build_request_declined_mail, send_mail};
use crate::state::{CurrentSession, St};
use chrono::{Datelike, Timelike};
use crate::util::*;
use serde_json::{json, Map, Value};

type Res<T> = Result<T, DomainError>;

fn v(row: &Row) -> Value {
    Value::Object(row.clone())
}

async fn sel(st: &St, table: &str, params: &[(&str, &str)]) -> Res<Vec<Row>> {
    let p: Vec<(String, String)> = params.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    st.supa.select(table, &p).await.map_err(DomainError::from_supa)
}

/* ── camelCase row views ──────────────────────────────────────────────── */

fn journal_view(r: &Row) -> Value {
    let rv = v(r);
    json!({
        "id": rv.get("id").cloned().unwrap_or(Value::Null),
        "promptKey": rv.get("prompt_key").cloned().unwrap_or(Value::Null),
        "content": rv.get("content").cloned().unwrap_or(Value::Null),
        "createdAt": rv.get("created_at").cloned().unwrap_or(Value::Null),
        "updatedAt": rv.get("updated_at").cloned().unwrap_or(Value::Null),
    })
}

fn mood_view(r: &Row) -> Value {
    let rv = v(r);
    json!({
        "id": rv.get("id").cloned().unwrap_or(Value::Null),
        "date": rv.get("date").cloned().unwrap_or(Value::Null),
        "mood": rv.get("mood").cloned().unwrap_or(Value::Null),
        "energy": rv.get("energy").cloned().unwrap_or(Value::Null),
        "sleepQ": rv.get("sleep_q").cloned().unwrap_or(Value::Null),
        "tags": rv.get("tags").cloned().unwrap_or(Value::Null),
        "note": rv.get("note").cloned().unwrap_or(Value::Null),
        "createdAt": rv.get("created_at").cloned().unwrap_or(Value::Null),
        "updatedAt": rv.get("updated_at").cloned().unwrap_or(Value::Null),
    })
}

fn appointment_view(r: &Row) -> Value {
    let rv = v(r);
    json!({
        "id": rv.get("id").cloned().unwrap_or(Value::Null),
        "psychologistSlug": rv.get("psychologist_slug").cloned().unwrap_or(Value::Null),
        "startAt": rv.get("start_at").cloned().unwrap_or(Value::Null),
        "mode": rv.get("mode").cloned().unwrap_or(Value::Null),
        "price": rv.get("price").filter(|p| !p.is_null()).cloned().unwrap_or(Value::Null),
        "status": rv.get("status").cloned().unwrap_or(Value::Null),
        "payment": rv.get("payment").cloned().unwrap_or(Value::Null),
        "createdAt": rv.get("created_at").cloned().unwrap_or(Value::Null),
        "message": match rv.get("message") { Some(Value::String(s)) => json!(s), _ => Value::Null },
        "respondedAt": match rv.get("responded_at") { Some(Value::String(s)) => json!(s), _ => Value::Null },
    })
}

/* ── Journal ──────────────────────────────────────────────────────────── */

pub async fn journal_list(st: &St, user: &Value) -> Res<Value> {
    let uid = s(user, "id");
    let entries = sel(st, "journal_entries_v2", &[("select", "*"), ("user_id", &format!("eq.{uid}")), ("order", "created_at.desc"), ("limit", "200")]).await?;
    let moods = sel(st, "mood_logs", &[("select", "date,mood,energy,sleep_q"), ("user_id", &format!("eq.{uid}")), ("order", "date.asc"), ("limit", "365")]).await?;
    Ok(json!({
        "entries": entries.iter().map(journal_view).collect::<Vec<_>>(),
        "moods": moods.iter().map(mood_view).collect::<Vec<_>>(),
    }))
}

pub async fn journal_create(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let content = match body.get("content") {
        Some(Value::String(s)) => s.trim().to_string(),
        _ => String::new(),
    };
    let prompt_key = match body.get("promptKey") {
        Some(Value::String(s)) if s.len() <= 80 => Some(s.clone()),
        _ => None,
    };
    if content.is_empty() || char_len(&content) > 4000 {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    let row = st
        .supa
        .insert(
            "journal_entries_v2",
            &json!({
                "user_id": s(user, "id"),
                "content": content,
                "prompt_key": prompt_key,
            }),
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({ "id": row.and_then(|r| r.get("id").cloned()).unwrap_or(Value::Null) }))
}

pub async fn journal_delete(st: &St, user: &Value, id: &str) -> Res<Value> {
    if id.is_empty() {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    let row = st
        .supa
        .select_one("journal_entries_v2", &[("select", "id,user_id"), ("id", &format!("eq.{id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(row) = row else { return Err(DomainError::Api(ApiError::not_found())) };
    if s(&v(&row), "user_id") != s(user, "id") {
        return Err(DomainError::Api(ApiError::not_found()));
    }
    st.supa
        .delete("journal_entries_v2", &vec![("id".into(), format!("eq.{}", s(&v(&row), "id")))])
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({ "ok": true }))
}

/* ── Mood check-ins ───────────────────────────────────────────────────── */

pub async fn mood_list(st: &St, user: &Value) -> Res<Value> {
    let uid = s(user, "id");
    let logs = sel(st, "mood_logs", &[("select", "*"), ("user_id", &format!("eq.{uid}")), ("order", "date.asc"), ("limit", "60")]).await?;
    let quiz = sel(st, "quiz_results", &[("select", "id,quiz_id,score,max_score,created_at"), ("user_id", &format!("eq.{uid}")), ("order", "created_at.desc"), ("limit", "6")]).await?;
    Ok(json!({
        "logs": logs.iter().map(mood_view).collect::<Vec<_>>(),
        "quizResults": quiz
            .iter()
            .map(|q| {
                json!({
                    "id": v(q).get("id").cloned().unwrap_or(Value::Null),
                    "quizId": v(q).get("quiz_id").cloned().unwrap_or(Value::Null),
                    "score": v(q).get("score").cloned().unwrap_or(Value::Null),
                    "maxScore": v(q).get("max_score").cloned().unwrap_or(Value::Null),
                    "createdAt": v(q).get("created_at").cloned().unwrap_or(Value::Null),
                })
            })
            .collect::<Vec<_>>(),
    }))
}

pub async fn mood_upsert(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let in_range = |key: &str| -> bool {
        matches!(body.get(key), Some(Value::Number(n)) if n.as_i64().map(|i| (1..=5).contains(&i)).unwrap_or(false))
    };
    if !in_range("mood") || !in_range("energy") || !in_range("sleepQ") {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    let mood = i64_opt(body, "mood").unwrap_or(0);
    let energy = i64_opt(body, "energy").unwrap_or(0);
    let sleep_q = i64_opt(body, "sleepQ").unwrap_or(0);

    let mut tags: Vec<String> = Vec::new();
    if let Some(Value::Array(arr)) = body.get("tags") {
        for t in arr {
            if let Value::String(ts) = t {
                // char-length (not bytes) — consistent with every other cap.
                if char_len(ts) <= 24 && !tags.contains(ts) {
                    tags.push(ts.clone());
                }
            }
        }
        tags.truncate(5);
    }
    let note = match body.get("note") {
        Some(Value::String(ns)) => {
            let trimmed = ns.trim();
            if trimmed.is_empty() { String::new() } else { char_take(trimmed, 280) }
        }
        _ => String::new(),
    };
    let uid = s(user, "id");
    let date = baku_parts(now_ms()).date;

    // Serialize check-then-insert against concurrent same-day requests —
    // two parallel posts would both see no row and create duplicates.
    let _guard = st.write_lock.lock().await;
    let existing = st
        .supa
        .select_one("mood_logs", &[("select", "id"), ("user_id", &format!("eq.{uid}")), ("date", &format!("eq.{date}"))])
        .await
        .map_err(DomainError::from_supa)?;

    let payload = json!({
        "mood": mood,
        "energy": energy,
        "sleep_q": sleep_q,
        "tags": tags.join(","),
        "note": if note.is_empty() { Value::Null } else { json!(note) },
    });
    if existing.is_some() {
        st.supa
            .update(
                "mood_logs",
                &vec![("user_id".into(), format!("eq.{uid}")), ("date".into(), format!("eq.{date}"))],
                &payload,
            )
            .await
            .map_err(DomainError::from_supa)?;
    } else {
        let mut full = payload.as_object().cloned().unwrap_or_default();
        full.insert("user_id".into(), json!(uid));
        full.insert("date".into(), json!(date));
        st.supa
            .insert("mood_logs", &Value::Object(full))
            .await
            .map_err(DomainError::from_supa)?;
    }
    Ok(json!({ "ok": true, "date": date }))
}

/* ── Quizzes ──────────────────────────────────────────────────────────── */

pub async fn quiz_submit(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let quiz_id = s(body, "quizId");
    let empty: Vec<Value> = Vec::new();
    let answers_raw = body.get("answers").and_then(|a| a.as_array()).cloned().unwrap_or(empty);

    if answers_raw.is_empty() || answers_raw.len() > 6 {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    let quiz = st
        .supa
        .select_one("quizzes", &[("select", "code"), ("code", &format!("eq.{quiz_id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    if quiz.is_none() {
        return Err(DomainError::Api(ApiError::bad_request()));
    }

    let mut answers: Vec<i64> = Vec::new();
    for a in &answers_raw {
        let n: i64 = match a {
            Value::Number(n) if n.as_i64().is_some() => n.as_i64().unwrap_or(0),
            Value::String(s) if is_int_str(s) => s.parse().unwrap_or(0),
            _ => return Err(DomainError::Api(ApiError::bad_request())),
        };
        if !(0..=3).contains(&n) {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        answers.push(n);
    }
    let score: i64 = answers.iter().sum();
    let max_score = std::cmp::max(9, (answers.len() * 3) as i64);
    let row = st
        .supa
        .insert(
            "quiz_results",
            &json!({
                "user_id": s(user, "id"),
                "quiz_id": quiz_id,
                "score": score,
                "max_score": max_score,
                "answers": answers,
            }),
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({
        "id": row.and_then(|r| r.get("id").cloned()).unwrap_or(Value::Null),
        "score": score,
        "maxScore": max_score,
    }))
}

fn is_int_str(s: &str) -> bool {
    let body = s.strip_prefix('-').unwrap_or(s);
    !body.is_empty() && body.chars().all(|c| c.is_ascii_digit())
}

/* ── Bookings ─────────────────────────────────────────────────────────── */

pub async fn book_count(st: &St) -> Res<Value> {
    let rows = sel(st, "psychologists_v2", &[("select", "slug")]).await?;
    Ok(json!({ "count": rows.len() }))
}

pub async fn book(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let slug = s(body, "slug");
    let date = s(body, "date");
    let mode = if s(body, "mode") == "office" { "office" } else { "online" };
    let custom = body.get("custom") == Some(&json!(true));

    let hour = match body.get("hour") {
        Some(Value::Number(n)) if n.as_i64().is_some() => n.as_i64().unwrap_or(-1),
        _ => -1,
    };
    if !(0..=23).contains(&hour) {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    if !is_date_str(&date) {
        return Err(DomainError::Api(ApiError::bad_request()));
    }

    let message = match body.get("message") {
        Some(Value::String(m)) => m.trim().to_string(),
        _ => String::new(),
    };
    let message_len = char_len(&message);
    if message_len < 1 || message_len > 1000 {
        return Err(DomainError::Api(ApiError::bad_request()));
    }

    let psy = st
        .supa
        .select_one("psychologists_v2", &[("select", "slug,price"), ("slug", &format!("eq.{slug}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(psy) = psy else { return Err(DomainError::Api(ApiError::bad_request())) };

    let start_ms = baku_instant(&date, hour);
    let Some(start_ms) = start_ms else { return Err(DomainError::Api(ApiError::bad_request())) };
    if baku_parts(start_ms).date != date {
        return Err(DomainError::Api(ApiError::bad_request()));
    }

    if !custom {
        // v5.2 (loop iter 3): the same 60-day window as the custom path —
        // direct API calls could previously book slots years ahead (the
        // grid only shows two weeks, the API never bounded the date).
        let today = baku_parts(now_ms()).date;
        if date > plus_days(&today, 60) {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        let Some(weekday) = weekday_of(&date) else { return Err(DomainError::Api(ApiError::bad_request())) };
        let avail = sel(st, "psychologist_availability", &[("select", "day,from_hour,to_hour"), ("psychologist_slug", &format!("eq.{slug}"))]).await?;
        let in_block = avail.iter().any(|b| {
            let bv = v(b);
            i64_opt(&bv, "day") == Some(weekday)
                && hour >= i64_opt(&bv, "from_hour").unwrap_or(-1)
                && hour < i64_opt(&bv, "to_hour").unwrap_or(-1)
        });
        if !in_block {
            return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "slot_closed")));
        }
    } else {
        if hour < 6 || hour > 23 {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        let today = baku_parts(now_ms()).date;
        if date < today {
            return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "slot_past")));
        }
        if date > plus_days(&today, 60) {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
    }
    if start_ms <= now_ms() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "slot_past")));
    }

    let start_iso = ms_to_iso(start_ms);
    let uid = s(user, "id");
    // Serialize the slot-check + insert: two concurrent POSTs for the same
    // slot would both pass the clash select and double-book it.
    let _guard = st.write_lock.lock().await;
    let clash = st
        .supa
        .select_one(
            "appointments",
            &[
                ("select", "id"),
                ("psychologist_slug", &format!("eq.{slug}")),
                ("start_at", &format!("eq.{start_iso}")),
                ("status", "neq.cancelled"),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    if clash.is_some() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "slot_taken")));
    }
    let own = sel(
        st,
        "appointments",
        &[
            ("select", "id"),
            ("user_id", &format!("eq.{uid}")),
            ("start_at", &format!("eq.{start_iso}")),
            ("status", "neq.cancelled"),
        ],
    )
    .await?;
    if !own.is_empty() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "double_booked")));
    }

    let row = st
        .supa
        .insert(
            "appointments",
            &json!({
                "user_id": uid,
                "psychologist_slug": slug,
                "start_at": start_iso,
                "mode": mode,
                "price": v(&psy).get("price").cloned().unwrap_or(Value::Null),
                "status": "requested",
                "payment": "unpaid",
                "message": message,
            }),
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({
        "id": row.and_then(|r| r.get("id").cloned()).unwrap_or(Value::Null),
        "status": "requested",
    }))
}

pub async fn cancel(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let id = s(body, "id");
    if id.is_empty() {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    let row = st
        .supa
        .select_one("appointments", &[("select", "*"), ("id", &format!("eq.{id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(row) = row else { return Err(DomainError::Api(ApiError::not_found())) };
    let rv = v(&row);
    if s(&rv, "user_id") != s(user, "id") {
        return Err(DomainError::Api(ApiError::not_found()));
    }
    if let Some(start) = s_opt(&rv, "start_at").and_then(|t| parse_iso_ms(&t)) {
        if start <= now_ms() {
            return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "already_started")));
        }
    }
    st.supa
        .update("appointments", &vec![("id".into(), format!("eq.{}", s(&rv, "id")))], &json!({ "status": "cancelled" }))
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({ "ok": true }))
}

pub async fn pay(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let id = s(body, "id");
    if id.is_empty() {
        return Err(DomainError::Api(ApiError::bad_request()));
    }
    let row = st
        .supa
        .select_one("appointments", &[("select", "id,user_id,status"), ("id", &format!("eq.{id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(row) = row else { return Err(DomainError::Api(ApiError::not_found())) };
    let rv = v(&row);
    if s(&rv, "user_id") != s(user, "id") {
        return Err(DomainError::Api(ApiError::not_found()));
    }
    if s(&rv, "status") != "confirmed" {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "not_confirmed")));
    }
    st.supa
        .update("appointments", &vec![("id".into(), format!("eq.{}", s(&rv, "id")))], &json!({ "payment": "paid", "status": "upcoming" }))
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({ "ok": true }))
}

/* ── Psychologist console (v3.4) ──────────────────────────────────────── */

fn require_psych_console(user: &Value) -> Res<String> {
    if s(user, "role") == "psychologist" {
        let slug = s(user, "psychSlug");
        if !slug.is_empty() {
            return Ok(slug);
        }
    }
    Err(DomainError::Api(ApiError::unauthorized()))
}

/// "12 dekabr 2026, 15:00" — a Baku wall-clock label (Intl-style).
fn baku_label(locale: &str, start_at: &str) -> String {
    let Some(ms) = parse_iso_ms(start_at) else { return start_at.to_string() };
    let shifted = ms + BAKU_OFFSET_MS;
    let Some(dt) = chrono::DateTime::from_timestamp_millis(shifted) else { return start_at.to_string() };
    let month = match locale {
        "en" => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][dt.month0() as usize].to_string(),
        "ru" => ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"][dt.month0() as usize].to_string(),
        _ => ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"][dt.month0() as usize].to_string(),
    };
    format!("{} {}, {}, {:02}:{:02}", dt.day(), month, dt.year(), dt.hour(), dt.minute())
}

/// The psychologist's display name in the CLIENT's locale.
async fn psy_display_name(st: &St, locale: &str, slug: &str) -> String {
    let name_key = match st
        .supa
        .select_one("psychologists_v2", &[("select", "name_key"), ("slug", &format!("eq.{slug}"))])
        .await
    {
        Ok(Some(row)) => {
            let nk = s(&v(&row), "name_key");
            if nk.is_empty() { return slug.to_string(); }
            nk
        }
        _ => return slug.to_string(),
    };
    match crate::messages::lookup(st, locale, &format!("psychApp.{name_key}")).await {
        Some(name) if !name.is_empty() => name,
        _ => slug.to_string(),
    }
}

/// One client of the console: e-mail from auth, name from profiles.
async fn client_of(st: &St, user_id: &str) -> (Option<String>, Option<String>) {
    let mut email = None;
    let mut name = None;
    if let Ok(au) = st.supa.admin_get_user(user_id).await {
        email = au.get("email").and_then(|e| e.as_str()).map(String::from);
    }
    if let Ok(Some(prof)) = st
        .supa
        .select_one("profiles", &[("select", "full_name"), ("id", &format!("eq.{user_id}"))])
        .await
    {
        let n = s_opt(&v(&prof), "full_name");
        if n.is_some() {
            name = n;
        }
    }
    (name, email)
}

/// v5.2 (loop iter 3): batched clients for a console page — ONE profiles
/// select (id=in.(…)) plus CONCURRENT admin_get_user calls. The old
/// per-row loop cost two sequential upstream round-trips per appointment
/// (~80 for a full pending+confirmed+upcoming page).
async fn clients_of(st: &St, user_ids: &[String]) -> std::collections::HashMap<String, (Option<String>, Option<String>)> {
    use std::collections::{HashMap, HashSet};
    let mut map: HashMap<String, (Option<String>, Option<String>)> = HashMap::new();
    let mut seen = HashSet::new();
    let unique: Vec<&String> = user_ids.iter().filter(|id| !id.is_empty() && seen.insert((*id).clone())).collect();
    if unique.is_empty() {
        return map;
    }
    // Names — one PostgREST select with id=in.(…).
    let in_list = unique.iter().map(|id| id.as_str()).collect::<Vec<_>>().join(",");
    if let Ok(rows) = st
        .supa
        .select("profiles", &[("select", "id,full_name"), ("id", &format!("in.({in_list})"))])
        .await
    {
        for r in rows {
            let rv = v(&r);
            let id = s(&rv, "id");
            if id.is_empty() {
                continue;
            }
            map.insert(id, (s_opt(&rv, "full_name"), None));
        }
    }
    // E-mails — concurrent per-id admin lookups (GoTrue has no batch get).
    let fetches = unique.iter().map(|id| {
        let fut = st.supa.admin_get_user(id);
        async move {
            let email = fut
                .await
                .ok()
                .and_then(|au| au.get("email").and_then(|e| e.as_str()).map(String::from));
            ((*id).clone(), email)
        }
    });
    for (id, email) in futures::future::join_all(fetches).await {
        map.entry(id).or_insert((None, None)).1 = email;
    }
    map
}

pub async fn console_list(st: &St, user: &Value) -> Res<Value> {
    let slug = require_psych_console(user)?;

    let pending = sel(st, "appointments", &[("select", "*"), ("psychologist_slug", &format!("eq.{slug}")), ("status", "eq.requested"), ("order", "start_at.asc"), ("limit", "20")]).await?;
    let confirmed = sel(st, "appointments", &[("select", "*"), ("psychologist_slug", &format!("eq.{slug}")), ("status", "eq.confirmed"), ("order", "start_at.asc"), ("limit", "10")]).await?;
    let upcoming = sel(st, "appointments", &[("select", "*"), ("psychologist_slug", &format!("eq.{slug}")), ("status", "eq.upcoming"), ("start_at", &format!("gt.{}", now_iso())), ("order", "start_at.asc"), ("limit", "10")]).await?;
    let avail = sel(st, "psychologist_availability", &[("select", "day,from_hour,to_hour"), ("psychologist_slug", &format!("eq.{slug}"))]).await?;

    let is_custom = |r: &Row| -> bool {
        let Some(ts) = parse_iso_ms(&s(&v(r), "start_at")) else { return false };
        let parts = baku_parts(ts);
        !avail.iter().any(|b| {
            let bv = v(b);
            i64_opt(&bv, "day") == Some(parts.weekday)
                && parts.hour >= i64_opt(&bv, "from_hour").unwrap_or(-1)
                && parts.hour < i64_opt(&bv, "to_hour").unwrap_or(-1)
        })
    };

    // v5.2 (loop iter 3): resolve every client once, in two batched
    // upstream passes, instead of a per-row e-mail+name lookup.
    let ids: Vec<String> = pending
        .iter()
        .chain(&confirmed)
        .chain(&upcoming)
        .map(|r| s(&v(r), "user_id"))
        .collect();
    let clients = clients_of(st, &ids).await;
    // The view closure runs once per list — capture the map (and the
    // is_custom closure) by reference so each async block only moves a
    // Copy &handle, keeping the closure Fn instead of FnOnce.
    let clients_ref = &clients;
    let is_custom_ref = &is_custom;

    let view = |rows: Vec<Row>| async move {
        let mut out = Vec::new();
        for r in rows {
            let (name, email) = clients_ref
                .get(&s(&v(&r), "user_id"))
                .cloned()
                .unwrap_or((None, None));
            let mut obj = appointment_view(&r).as_object().cloned().unwrap_or_default();
            obj.insert("custom".into(), json!(is_custom_ref(&r)));
            obj.insert("client".into(), json!({ "name": name, "email": email }));
            out.push(Value::Object(obj));
        }
        out
    };

    Ok(json!({
        "slug": slug,
        "pending": view(pending).await,
        "confirmed": view(confirmed).await,
        "upcoming": view(upcoming).await,
    }))
}

pub async fn console_respond(st: &St, user: &Value, body: &Value, origin: &str) -> Res<Value> {
    let slug = require_psych_console(user)?;

    let id = s(body, "id");
    let action = match s(body, "action").as_str() {
        "confirm" => "confirm",
        "decline" => "decline",
        _ => "",
    };
    if id.is_empty() || action.is_empty() {
        return Err(DomainError::Api(ApiError::bad_request()));
    }

    let row = st
        .supa
        .select_one("appointments", &[("select", "*"), ("id", &format!("eq.{id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(row) = row else { return Err(DomainError::Api(ApiError::not_found())) };
    let rv = v(&row);
    if s(&rv, "psychologist_slug") != slug {
        return Err(DomainError::Api(ApiError::not_found()));
    }
    if s(&rv, "status") != "requested" {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::CONFLICT, "not_confirmed")));
    }

    let now = now_iso();
    if action == "confirm" {
        st.supa
            .update("appointments", &vec![("id".into(), format!("eq.{id}"))], &json!({ "status": "confirmed", "responded_at": now }))
            .await
            .map_err(DomainError::from_supa)?;
    } else {
        st.supa
            .update("appointments", &vec![("id".into(), format!("eq.{id}"))], &json!({ "status": "cancelled", "responded_at": now }))
            .await
            .map_err(DomainError::from_supa)?;
    }

    // Best-effort outcome mail — a mail failure never fails the response.
    let user_id = s(&rv, "user_id");
    let (_name, email) = client_of(st, &user_id).await;
    if let Some(email) = email {
        let mut locale = "az".to_string();
        if let Ok(Some(prof)) = st
            .supa
            .select_one("profiles", &[("select", "lang"), ("id", &format!("eq.{user_id}"))])
            .await
        {
            let lang = s(&v(&prof), "lang");
            if lang == "en" || lang == "ru" || lang == "az" {
                locale = lang;
            }
        }
        let psychologist = psy_display_name(st, &locale, &slug).await;
        let start_at = s(&rv, "start_at");
        let start_at_label = baku_label(&locale, &start_at);
        if action == "confirm" {
            let (subject, html) = build_payment_due_mail(
                &locale,
                crate::mail::PaymentDueInput {
                    psychologist: &psychologist,
                    start_at_label: &start_at_label,
                    mode: &if s(&rv, "mode") == "office" { "office".to_string() } else { "online".to_string() },
                    price: n_opt(&rv, "price"),
                    link: &format!("{origin}/meditation/bookings"),
                },
            );
            let _ = send_mail(st, crate::mail::MailMessage { to: email, subject, html, kind: "session_confirmed".into() }).await;
        } else {
            let (subject, html) = build_request_declined_mail(&locale, &psychologist, &start_at_label);
            let _ = send_mail(st, crate::mail::MailMessage { to: email, subject, html, kind: "session_declined".into() }).await;
        }
    }

    Ok(json!({ "ok": true, "status": if action == "confirm" { "confirmed" } else { "cancelled" } }))
}

/* ── Meditation media progress ────────────────────────────────────────── */

pub async fn progress(st: &St, user: &Value, body: &Value) -> Res<Value> {
    let resource_id = s(body, "resourceId");
    let seconds = n_opt(body, "seconds");

    let resource = st
        .supa
        .select_one("media_resources", &[("select", "id,kind"), ("id", &format!("eq.{resource_id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(resource) = resource else { return Err(DomainError::Api(ApiError::bad_request())) };
    let Some(seconds) = seconds else { return Err(DomainError::Api(ApiError::bad_request())) };
    if !(1.0..=7200.0).contains(&seconds) {
        return Err(DomainError::Api(ApiError::bad_request()));
    }

    st.supa
        .insert(
            "meditation_progress",
            &json!({
                "user_id": s(user, "id"),
                "resource_id": resource_id,
                "kind": s(&v(&resource), "kind"),
                "seconds": seconds.round(),
                "completed": body.get("completed") == Some(&json!(true)),
            }),
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({ "ok": true }))
}

/* ── Page-facing aggregates ───────────────────────────────────────────── */

pub async fn bookings_list(st: &St, user: &Value) -> Res<Value> {
    let rows = sel(
        st,
        "appointments",
        &[("select", "*"), ("user_id", &format!("eq.{}", s(user, "id"))), ("order", "start_at.desc"), ("limit", "60")],
    )
    .await?;
    Ok(json!({ "appointments": rows.iter().map(appointment_view).collect::<Vec<_>>() }))
}

pub async fn schedule_window(st: &St, user: &Value) -> Res<Value> {
    let rows = sel(
        st,
        "appointments",
        &[
            ("select", "user_id,psychologist_slug,start_at"),
            ("start_at", &format!("gte.{}", now_iso())),
            ("start_at", &format!("lte.{}", iso_plus_ms(14 * 24 * 60 * 60 * 1000))),
            ("status", "neq.cancelled"),
        ],
    )
    .await?;
    let to_pair = |r: &Row| {
        json!({ "startAt": v(r).get("start_at").cloned().unwrap_or(Value::Null), "psychologistSlug": v(r).get("psychologist_slug").cloned().unwrap_or(Value::Null) })
    };
    let uid = s(user, "id");
    Ok(json!({
        "mine": rows.iter().filter(|r| s(&v(r), "user_id") == uid).map(|r| to_pair(r)).collect::<Vec<_>>(),
        "all": rows.iter().map(|r| to_pair(r)).collect::<Vec<_>>(),
    }))
}

pub async fn overview(st: &St, user: &Value) -> Res<Value> {
    let now = now_iso();
    let uid = s(user, "id");

    let logs = sel(st, "mood_logs", &[("select", "*"), ("user_id", &format!("eq.{uid}")), ("order", "date.desc"), ("limit", "60")]).await?;
    let upcoming = sel(
        st,
        "appointments",
        &[
            ("select", "*"),
            ("user_id", &format!("eq.{uid}")),
            ("status", "in.(requested,confirmed,upcoming)"),
            ("start_at", &format!("gt.{now}")),
            ("order", "start_at.asc"),
            ("limit", "3"),
        ],
    )
    .await?;
    let prog = sel(
        st,
        "meditation_progress",
        &[("select", "seconds"), ("user_id", &format!("eq.{uid}")), ("created_at", &format!("gte.{}", iso_plus_ms(-7 * 24 * 60 * 60 * 1000)))],
    )
    .await?;
    let week_seconds: f64 = prog.iter().filter_map(|r| n_opt(&v(r), "seconds")).sum();
    let done = sel(
        st,
        "appointments",
        &[("select", "id"), ("user_id", &format!("eq.{uid}")), ("status", "eq.upcoming"), ("start_at", &format!("lte.{now}"))],
    )
    .await?;

    Ok(json!({
        "logs": logs.iter().map(mood_view).collect::<Vec<_>>(),
        "upcoming": upcoming.iter().map(appointment_view).collect::<Vec<_>>(),
        "weekSeconds": week_seconds,
        "doneSessions": done.len(),
    }))
}

/// (name, email) view reuse guard.
#[allow(dead_code)]
fn _unused(_: &CurrentSession) {}
#[allow(dead_code)]
fn _unused_map(_: Map<String, Value>) {}
