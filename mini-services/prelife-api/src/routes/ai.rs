//! POST /api/ai/chat (public) — the site assistant with the v4.7 cost
//! ceiling (10/min per IP guests, 30/min per account signed in).

use super::{json_ok, read_json};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::*;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::{json, Value};

pub async fn chat_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    let body = read_json(&body);
    let parsed = crate::ai::parse_chat_body(&body).map_err(|_| DomainError::Api(ApiError::bad_request()))?;
    let page = body
        .get("page")
        .and_then(|p| p.as_str())
        .map(|p| char_take(p, 120))
        .filter(|p| !p.is_empty());

    let user = session::current_session(&st, &headers)
        .await
        .map(|cs| {
            json!({
                "id": s(&cs.user, "id"),
                "email": s(&cs.user, "email"),
                "name": cs.user.get("name").cloned().unwrap_or(Value::Null),
            })
        });

    // Art. 9 gate: a signed-in chat sends (minimised) account context and
    // may carry health-adjacent text — the "ai" scope covers it. Guests
    // keep the plain assistant (no account data is attached at all).
    if let Some(u) = user.as_ref() {
        if !crate::consent::consent_granted(&st, s(u, "id").as_str(), "ai").await? {
            return Err(crate::consent::consent_error("ai"));
        }
    }

    // v4.7: the cost ceiling.
    let allowed = match user.as_ref() {
        Some(u) => st.rate_allow(&format!("ai:u:{}", s(u, "id")), 30, std::time::Duration::from_secs(60)),
        None => st.rate_allow(&format!("ai:ip:{}", crate::state::AppState::client_ip(&headers)), 10, std::time::Duration::from_secs(60)),
    };
    if !allowed {
        return Err(DomainError::Api(ApiError::json(429, "rate_limited")));
    }

    let history: Vec<(String, String)> = parsed.history;
    let out = crate::ai::assistant_reply(&st, &parsed.locale, &history, page.as_deref(), user.as_ref()).await?;
    Ok(json_ok(json!({ "reply": out.0, "source": out.1 })))
}
