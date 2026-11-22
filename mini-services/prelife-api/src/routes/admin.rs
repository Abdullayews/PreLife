//! /api/admin/console — the administrator's read-only platform overview
//! (v5.4 role system). Counts only, never raw rows: every number is
//! computed here from projected-column selects, so no personal data
//! (e-mails, names, notes) ever leaves the database through this route.

use super::{json_ok};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

/// Count rows of a table with a projected single column and a sane cap.
/// The projected column keeps the payload tiny; the cap bounds the work
/// for the current platform scale (the emu answers from memory either way).
async fn count(st: &St, table: &str, column: &str, extra: &[(&str, &str)]) -> Result<usize, DomainError> {
    let mut params: Vec<(String, String)> = vec![
        ("select".to_string(), column.to_string()),
        ("limit".to_string(), "10000".to_string()),
    ];
    for (k, v) in extra {
        params.push((k.to_string(), v.to_string()));
    }
    let rows = st
        .supa
        .select(table, &params)
        .await
        .map_err(DomainError::from_supa)?;
    Ok(rows.len())
}

/// GET /api/admin/console — { stats: { … } }. Admin role only; the role
/// rides the signed cookie session (checked server-side on every call).
pub async fn console_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    if crate::util::s(&cs.user, "role") != "admin" {
        return Err(err(403, "forbidden"));
    }

    // Open sessions (projected id only).
    let sessions = count(&st, "sessions", "id", &[]).await?;

    // The appointment funnel — status values are the v3.4 workflow's.
    let appt_rows = st
        .supa
        .select(
            "appointments",
            &vec![
                ("select".to_string(), "status".to_string()),
                ("limit".to_string(), "10000".to_string()),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    let mut appts = serde_json::Map::new();
    for key in ["requested", "confirmed", "upcoming", "cancelled"] {
        appts.insert(key.to_string(), serde_json::json!(0));
    }
    for row in &appt_rows {
        let status = crate::util::s(&serde_json::Value::Object(row.clone()), "status");
        if let Some(slot) = appts.get_mut(&status) {
            *slot = serde_json::json!(slot.as_i64().unwrap_or(0) + 1);
        }
    }

    // Content counts.
    let psychologists = count(&st, "psychologists_v2", "slug", &[]).await?;
    let halls = count(&st, "gym_places", "id,welcome_visible", &[]).await?;
    let welcome_visible = st
        .supa
        .select(
            "gym_places",
            &vec![
                ("select".to_string(), "id".to_string()),
                ("welcome_visible".to_string(), "eq.true".to_string()),
                ("limit".to_string(), "10000".to_string()),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?
        .len();
    let trainers = count(&st, "gym_trainers", "id", &[]).await?;

    // User activity counts.
    let custom_packages = count(&st, "custom_packages", "id", &[]).await?;
    let journal_entries = count(&st, "journal_entries_v2", "id", &[]).await?;
    let mood_logs = count(&st, "mood_logs", "id", &[]).await?;

    Ok(json_ok(serde_json::json!({
        "stats": {
            "sessions": sessions,
            "appointments": appts,
            "psychologists": psychologists,
            "halls": halls,
            "visibleHalls": welcome_visible,
            "trainers": trainers,
            "customPackages": custom_packages,
            "journalEntries": journal_entries,
            "moodLogs": mood_logs,
        }
    })))
}
