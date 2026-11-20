//! Server-to-server endpoints for the Next.js SSR layer (direct local
//! calls — no gateway hop, no XTransformPort).

use super::json_ok;
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::*;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::json;

fn unauthorized() -> DomainError {
    DomainError::Api(ApiError::unauthorized())
}

/// GET /internal/home — the /home page's three data reads in one call:
/// { plan, profile, packages } (cookie-authenticated like the API).
pub async fn home(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(DomainError::Api(ApiError::json(503, "supabase_unconfigured")));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(unauthorized)?;
    let uid = s(&cs.user, "id");
    let plan = crate::user_plans::get_active_plan(&st, &uid).await;
    let profile = crate::profile::get_profile_view(&st, &uid).await?;
    let packages = crate::packages::list_custom_packages(&st, &uid).await;
    Ok(json_ok(json!({
        "plan": plan,
        "profile": profile,
        "packages": packages,
    })))
}

/// GET /internal/config — { supabaseConfigured } (the gym page's
/// fallback flag).
pub async fn config(State(st): State<St>) -> Response {
    json_ok(json!({ "supabaseConfigured": st.cfg.db_ready() }))
}
