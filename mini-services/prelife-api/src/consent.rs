//! Data consents — the per-scope explicit consent for the health-adjacent
//! features (GDPR Art. 9 explicit consent, AZ PDPA consent, 152-FZ written
//! consent analog). The user_consents row IS the consent log: granting and
//! revoking write timestamped states, and the mood / journal / quiz / AI
//! endpoints refuse with 403 consent_required_<scope> until granted.

use crate::error::{ApiError, DomainError};
use crate::state::St;
use crate::util::*;
use serde_json::{json, Value};

type Res<T> = Result<T, DomainError>;

/// The gated scopes. "ai" covers every AI feature that sends the user's
/// text (and, minimised, context) to the LLM provider: /api/ai/chat for
/// signed-in users and /api/psych/ai.
pub const SCOPES: &[&str] = &["mood", "journal", "quiz", "ai"];

pub fn scope_valid(scope: &str) -> bool {
    SCOPES.contains(&scope)
}

/* ── the view (scope -> granted) ───────────────────────────────────────── */

/// All scopes with their current state (missing row = not granted).
pub async fn consents_map(st: &St, user_id: &str) -> Res<Value> {
    let rows = st
        .supa
        .select(
            "user_consents",
            &vec![("select".into(), "scope,granted".into()), ("user_id".into(), format!("eq.{user_id}"))],
        )
        .await
        .map_err(DomainError::from_supa)?;
    let mut out = serde_json::Map::new();
    for scope in SCOPES {
        let granted = rows.iter().any(|r| {
            let rv = Value::Object(r.clone());
            is_true(&rv, "granted") && s(&rv, "scope") == *scope
        });
        out.insert((*scope).to_string(), json!(granted));
    }
    Ok(Value::Object(out))
}

/// True when the scope is currently granted (missing row = not granted).
/// A transport error fails CLOSED — the gate must never open on a broken
/// database.
pub async fn consent_granted(st: &St, user_id: &str, scope: &str) -> Res<bool> {
    let rows = st
        .supa
        .select_one(
            "user_consents",
            &vec![
                ("select".into(), "granted".into()),
                ("user_id".into(), format!("eq.{user_id}")),
                ("scope".into(), format!("eq.{scope}")),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(rows
        .map(|r| is_true(&Value::Object(r), "granted"))
        .unwrap_or(false))
}

/// The 403 gate error for a refused scope (consent_required_<scope>).
pub fn consent_error(scope: &str) -> DomainError {
    DomainError::Api(ApiError::json(
        403,
        &format!("consent_required_{scope}"),
    ))
}

/* ── grant / withdraw ─────────────────────────────────────────────────── */

/// Set a scope's consent state (idempotent upsert with a timestamped
/// event). Granting refreshes granted_at and clears revoked_at;
/// withdrawing marks granted=false + revoked_at=now. No-op when the state
/// already matches, so the log never accumulates duplicate events.
pub async fn consent_set(st: &St, user_id: &str, scope: &str, granted: bool) -> Res<Value> {
    let existing = st
        .supa
        .select_one(
            "user_consents",
            &vec![
                ("select".into(), "granted".into()),
                ("user_id".into(), format!("eq.{user_id}")),
                ("scope".into(), format!("eq.{scope}")),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    if let Some(row) = &existing {
        if is_true(&Value::Object(row.clone()), "granted") == granted {
            return consents_map(st, user_id).await;
        }
    }
    let now = now_iso();
    match existing {
        Some(row) => {
            let patch = if granted {
                json!({ "granted": true, "granted_at": now, "revoked_at": null, "updated_at": now })
            } else {
                json!({ "granted": false, "revoked_at": now, "updated_at": now })
            };
            st.supa
                .update(
                    "user_consents",
                    &vec![("id".into(), format!("eq.{}", s(&Value::Object(row.clone()), "id")))],
                    &patch,
                )
                .await
                .map_err(DomainError::from_supa)?;
        }
        None => {
            let row = if granted {
                json!({ "user_id": user_id, "scope": scope, "granted": true, "granted_at": now })
            } else {
                json!({ "user_id": user_id, "scope": scope, "granted": false, "revoked_at": now })
            };
            st.supa
                .insert("user_consents", &row)
                .await
                .map_err(DomainError::from_supa)?;
        }
    }
    consents_map(st, user_id).await
}
