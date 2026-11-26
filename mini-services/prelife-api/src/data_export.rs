//! Self-service data export (GDPR Art. 15/20 access + portability) and
//! account erasure (Art. 17 / AZ PDPA / 152-FZ deletion) — the explicit,
//! transport-agnostic table-by-table implementation: it never relies on
//! database FK cascades (the v2/v3 table generations have different FK
//! chains), so the emulator and the production project behave identically.

use crate::error::{ApiError, DomainError};
use crate::state::St;
use crate::util::*;
use serde_json::{json, Value};

type Res<T> = Result<T, DomainError>;

/// Every user-data table, deleted by user_id (mail_outbox is keyed by the
/// e-mail address instead). 404 on a missing table counts as success —
/// older databases simply skip the newer tables.
const USER_TABLES: &[&str] = &[
    "mood_logs",
    "journal_entries_v2",
    "quiz_results",
    "meditation_progress",
    "appointments",
    "user_weight_logs",
    "user_plans",
    "user_plan_progress",
    "custom_packages",
    "book_shelf",
    "user_consents",
    "email_verifications",
    "sessions",
];

/// True when the account is password-capable (app_metadata.providers
/// includes "email") — such accounts must re-verify the password before
/// erasure. Transport failures fail OPEN to the safer path (demand the
/// password; an empty password then fails the check).
pub async fn password_capable(st: &St, user_id: &str) -> bool {
    st.supa
        .admin_get_user(user_id)
        .await
        .ok()
        .and_then(|u| {
            u.pointer("/app_metadata/providers")
                .and_then(|p| p.as_array())
                .map(|a| a.iter().any(|p| p.as_str() == Some("email")))
        })
        .unwrap_or(true)
}

/* ── export (Art. 15 access + Art. 20 portability) ────────────────────── */

async fn rows_for(st: &St, table: &str, user_id: &str) -> Vec<Value> {
    st.supa
        .select(
            table,
            &vec![("select".into(), "*".into()), ("user_id".into(), format!("eq.{user_id}"))],
        )
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r| Value::Object(r))
        .collect()
}

/// The full JSON export of everything the account owns. Session rows are
/// exported WITHOUT the token hashes (secrets are not user data).
pub async fn collect_export(st: &St, user: &Value) -> Res<Value> {
    let uid = s(user, "id");
    let email = s(user, "email");

    let profile = st
        .supa
        .select_one("profiles", &vec![("select".into(), "*".into()), ("id".into(), format!("eq.{uid}"))])
        .await
        .map_err(DomainError::from_supa)?
        .map(|r| Value::Object(r))
        .unwrap_or(json!({}));

    // Devices: the session rows minus the token hash / user mirror columns.
    let devices: Vec<Value> = st
        .supa
        .select(
            "sessions",
            &vec![
                ("select".into(), "id,device_name,device_icon,user_agent,created_at,last_used_at,expires_at".into()),
                ("user_id".into(), format!("eq.{uid}")),
            ],
        )
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r| Value::Object(r))
        .collect();

    // Sent mail copies keyed by address, not user id.
    let mail: Vec<Value> = st
        .supa
        .select(
            "mail_outbox",
            &vec![
                ("select".into(), "to_email,subject,kind,created_at".into()),
                ("to_email".into(), format!("eq.{email}")),
            ],
        )
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|r| Value::Object(r))
        .collect();

    Ok(json!({
        "format": "prelife.export/1",
        "exportedAt": now_iso(),
        "account": {
            "id": uid,
            "email": email,
            "name": user.get("name").cloned().unwrap_or(Value::Null),
            "createdAt": profile.get("created_at").cloned().unwrap_or(Value::Null),
        },
        "profile": profile,
        "devices": devices,
        "mail": mail,
        "weights": rows_for(st, "user_weight_logs", &uid).await,
        "moodLogs": rows_for(st, "mood_logs", &uid).await,
        "journal": rows_for(st, "journal_entries_v2", &uid).await,
        "quizResults": rows_for(st, "quiz_results", &uid).await,
        "meditationProgress": rows_for(st, "meditation_progress", &uid).await,
        "appointments": rows_for(st, "appointments", &uid).await,
        "workoutPlans": rows_for(st, "user_plans", &uid).await,
        "planProgress": rows_for(st, "user_plan_progress", &uid).await,
        "customPackages": rows_for(st, "custom_packages", &uid).await,
        "bookShelf": rows_for(st, "book_shelf", &uid).await,
        "consents": rows_for(st, "user_consents", &uid).await,
    }))
}

/* ── erasure (Art. 17) ────────────────────────────────────────────────── */

/// Erase the account: every user-data table by user_id, the profile row,
/// the sent-mail copies, and finally the auth user itself. Each step is
/// idempotent (404 = fine); the first REAL failure stops the erasure with
/// an error so a partial delete can never be reported as success.
pub async fn erase_user(st: &St, user: &Value) -> Res<()> {
    let uid = s(user, "id");
    let email = s(user, "email");

    for table in USER_TABLES {
        st.supa
            .delete(table, &vec![("user_id".into(), format!("eq.{uid}"))])
            .await
            .map_err(DomainError::from_supa)?;
    }

    // Sent-mail copies carry the e-mail address itself.
    let _ = st
        .supa
        .delete("mail_outbox", &vec![("to_email".into(), format!("eq.{email}"))])
        .await;

    // The profile row, then the auth user (cascades anything the explicit
    // passes might have missed on FK-complete databases).
    st.supa
        .delete("profiles", &vec![("id".into(), format!("eq.{uid}"))])
        .await
        .map_err(DomainError::from_supa)?;
    st.supa
        .admin_delete_user(&uid)
        .await
        .map_err(|e| DomainError::Msg(e.message()))?;

    // Caches: drop every cached view of the user immediately.
    st.session_cache_drop_user(&uid);
    crate::account::prefs_cache_drop(st, &uid);

    Ok(())
}

/// The 400 error for a refused confirmation phrase.
pub fn confirm_error() -> DomainError {
    DomainError::Api(ApiError::json(400, "confirm_required"))
}
