//! Account endpoints — preferences (language/theme/rail/location) and
//! devices (Settings → Devices). Port of lib/server/account.ts.

use crate::error::{ApiError, DomainError};
use crate::state::{CurrentSession, St};
use crate::util::*;
use serde_json::{json, Value};

type Res<T> = Result<T, DomainError>;

fn v(row: &Row) -> Value {
    Value::Object(row.clone())
}

/* ── Preferences ──────────────────────────────────────────────────────── */

fn prefs_view(row: Option<&Row>) -> Value {
    let locale = row.and_then(|r| s_opt(&v(r), "lang")).unwrap_or_else(|| "en".into());
    let theme = row.and_then(|r| s_opt(&v(r), "theme")).unwrap_or_else(|| "light".into());
    json!({
        "locale": locale,
        "theme": theme,
        "railFolded": row.map(|r| is_true(&v(r), "rail_folded")).unwrap_or(false),
        "contentLocation": if row.map(|r| s(&v(r), "content_location")).as_deref() == Some("az") { "az" } else { "global" },
    })
}

pub async fn preferences_get(st: &St, user_id: &str) -> Res<Value> {
    if let Some((at, cached)) = st.prefs_cache.lock().unwrap().get(user_id).cloned() {
        if at.elapsed() < std::time::Duration::from_secs(30) {
            return Ok(cached);
        }
    }
    let row = st
        .supa
        .select_one("profiles", &[("select", "lang,theme,rail_folded,content_location"), ("id", &format!("eq.{user_id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let view = prefs_view(row.as_ref());
    st.prefs_cache_put(user_id, view.clone());
    Ok(view)
}

pub fn prefs_cache_drop(st: &St, user_id: &str) {
    st.prefs_cache.lock().unwrap().remove(user_id);
}

pub async fn preferences_update(st: &St, user_id: &str, body: &Value) -> Res<Value> {
    let mut patch = serde_json::Map::new();
    if let Some(Value::String(locale)) = body.get("locale") {
        if !["az", "en", "ru"].contains(&locale.as_str()) {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        patch.insert("lang".into(), json!(locale));
    }
    if let Some(Value::String(theme)) = body.get("theme") {
        if !["light", "dark"].contains(&theme.as_str()) {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        patch.insert("theme".into(), json!(theme));
    }
    if let Some(rail) = body.get("railFolded") {
        match rail {
            Value::Bool(b) => patch.insert("rail_folded".into(), json!(b)),
            _ => return Err(DomainError::Api(ApiError::bad_request())),
        };
    }
    if let Some(loc) = body.get("contentLocation") {
        match loc {
            Value::String(s) if s == "global" || s == "az" => patch.insert("content_location".into(), json!(s)),
            _ => return Err(DomainError::Api(ApiError::bad_request())),
        };
    }
    if patch.is_empty() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "nothing_to_update")));
    }
    let rail = patch.get("rail_folded").cloned();
    let location = patch.get("content_location").cloned();
    let rows = st
        .supa
        .update("profiles", &vec![("id".into(), format!("eq.{user_id}"))], &Value::Object(patch))
        .await
        .map_err(DomainError::from_supa)?;

    st.prefs_cache.lock().unwrap().remove(user_id);
    st.session_cache_drop_user(user_id);

    if let Some(rail) = rail {
        let _ = st
            .supa
            .update("sessions", &vec![("user_id".into(), format!("eq.{user_id}"))], &json!({ "user_folded": rail }))
            .await;
    }
    if let Some(location) = location {
        let _ = st
            .supa
            .update("sessions", &vec![("user_id".into(), format!("eq.{user_id}"))], &json!({ "user_location": location }))
            .await;
    }

    Ok(prefs_view(rows.first()))
}

/* ── Devices ──────────────────────────────────────────────────────────── */

fn device_view(row: &Row, current_id: &str) -> Value {
    let id = s(&v(row), "id");
    json!({
        "id": id,
        "name": v(row).get("device_name").cloned().unwrap_or(Value::Null),
        "icon": v(row).get("device_icon").cloned().unwrap_or(Value::Null),
        "current": id == current_id,
        "createdAt": v(row).get("created_at").cloned().unwrap_or(Value::Null),
        "lastUsedAt": v(row).get("last_used_at").cloned().unwrap_or(Value::Null),
    })
}

pub async fn devices_list(st: &St, current: &CurrentSession) -> Res<Value> {
    let uid = s(&current.user, "id");
    let _ = st
        .supa
        .delete("sessions", &vec![("user_id".into(), format!("eq.{uid}")), ("expires_at".into(), format!("lt.{}", now_iso()))])
        .await;
    let rows = st
        .supa
        .select(
            "sessions",
            &vec![
                ("select".into(), "*".into()),
                ("user_id".into(), format!("eq.{uid}")),
                ("order".into(), "last_used_at.desc".into()),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json!({ "devices": rows.iter().map(|r| device_view(r, &current.session_id)).collect::<Vec<_>>() }))
}

async fn own_session(st: &St, current: &CurrentSession, id: &str) -> Res<Row> {
    let target = st
        .supa
        .select_one("sessions", &[("select", "*"), ("id", &format!("eq.{id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    let Some(target) = target else { return Err(DomainError::Api(ApiError::not_found())) };
    if s(&v(&target), "user_id") != s(&current.user, "id") {
        return Err(DomainError::Api(ApiError::not_found()));
    }
    Ok(target)
}

pub async fn device_update(st: &St, current: &CurrentSession, id: &str, body: &Value) -> Res<Value> {
    let target = own_session(st, current, id).await?;
    let target_id = s(&v(&target), "id");

    let mut patch = serde_json::Map::new();
    if let Some(Value::String(name)) = body.get("name") {
        let name = name.trim();
        if name.is_empty() || char_len(name) > 40 {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        patch.insert("device_name".into(), json!(name));
    }
    if let Some(Value::String(icon)) = body.get("icon") {
        if !crate::session::DEVICE_ICONS.contains(&icon.as_str()) {
            return Err(DomainError::Api(ApiError::bad_request()));
        }
        patch.insert("device_icon".into(), json!(icon));
    }
    if patch.is_empty() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "nothing_to_update")));
    }

    let rows = st
        .supa
        .update("sessions", &vec![("id".into(), format!("eq.{target_id}"))], &Value::Object(patch))
        .await
        .map_err(DomainError::from_supa)?;
    let Some(row) = rows.first() else { return Err(DomainError::Api(ApiError::not_found())) };
    st.session_cache_drop_session(&target_id);
    Ok(json!({ "device": device_view(row, &current.session_id) }))
}

pub async fn device_revoke(st: &St, current: &CurrentSession, id: &str) -> Res<Value> {
    own_session(st, current, id).await?;
    st.supa
        .delete("sessions", &vec![("id".into(), format!("eq.{id}"))])
        .await
        .map_err(DomainError::from_supa)?;
    st.session_cache_drop_session(id);
    Ok(json!({ "ok": true, "current": id == current.session_id }))
}
