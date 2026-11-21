//! /api/library/shelf — the user's saved books ("Rəfə qoy"). A thin
//! user-scoped CRUD over the book_shelf table (slug strings, ownership
//! enforced by the user_id filter).

use super::{json_ok, read_json};
use crate::error::{ApiError, DomainError};
use crate::session;
use crate::state::St;
use crate::util::s;
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::json;

fn err(status: u16, code: &str) -> DomainError {
    DomainError::Api(ApiError::json(status, code))
}

/// Slug shape: the world_items slugs (lowercase latin + dashes), <= 64 chars.
fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 64
        && slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

pub async fn shelf_get(State(st): State<St>, headers: HeaderMap) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let uid = s(&cs.user, "id");
    let rows = st
        .supa
        .select(
            "book_shelf",
            &vec![
                ("select".into(), "book_slug".into()),
                ("user_id".into(), format!("eq.{uid}")),
                ("order".into(), "created_at.asc".into()),
                ("limit".into(), "200".into()),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    let books: Vec<String> = rows.iter().map(|r| s(&serde_json::Value::Object(r.clone()), "book_slug")).collect();
    Ok(json_ok(json!({ "books": books })))
}

pub async fn shelf_post(State(st): State<St>, headers: HeaderMap, body: Bytes) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    let body = read_json(&body);
    let slug = s(&body, "slug");
    if !valid_slug(&slug) {
        return Err(err(400, "invalid"));
    }
    let uid = s(&cs.user, "id");

    // Shelf size ceiling — a shelf is a reading list, not a dump.
    let rows = st
        .supa
        .select(
            "book_shelf",
            &vec![
                ("select".into(), "id".into()),
                ("user_id".into(), format!("eq.{uid}")),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    if rows.len() >= 100 {
        return Err(err(409, "shelf_full"));
    }

    // Idempotent add: already shelved → ok (no duplicate row).
    let existing = st
        .supa
        .select_one(
            "book_shelf",
            &vec![
                ("select".into(), "id".into()),
                ("user_id".into(), format!("eq.{uid}")),
                ("book_slug".into(), format!("eq.{slug}")),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    if existing.is_some() {
        return Ok(json_ok(json!({ "ok": true, "books": count_view(&st, &uid).await })));
    }

    st.supa
        .insert("book_shelf", &json!({ "user_id": uid, "book_slug": slug }))
        .await
        .map_err(DomainError::from_supa)?;
    Ok(super::json_status(
        json!({ "ok": true, "books": count_view(&st, &uid).await }),
        axum::http::StatusCode::CREATED,
    ))
}

pub async fn shelf_delete(
    State(st): State<St>,
    Path(slug): Path<String>,
    headers: HeaderMap,
) -> Result<Response, DomainError> {
    if !st.cfg.db_ready() {
        return Err(err(503, "supabase_unconfigured"));
    }
    let cs = session::current_session(&st, &headers)
        .await
        .ok_or_else(|| err(401, "unauthorized"))?;
    if !valid_slug(&slug) {
        return Err(err(400, "invalid"));
    }
    let uid = s(&cs.user, "id");
    // Ownership rides the user_id filter — a foreign slug simply matches
    // nothing (delete count 0), so no IDOR surface exists.
    st.supa
        .delete(
            "book_shelf",
            &vec![
                ("user_id".into(), format!("eq.{uid}")),
                ("book_slug".into(), format!("eq.{slug}")),
            ],
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(json_ok(json!({ "ok": true, "books": count_view(&st, &uid).await })))
}

async fn count_view(st: &St, uid: &str) -> serde_json::Value {
    let rows = st
        .supa
        .select(
            "book_shelf",
            &vec![
                ("select".into(), "book_slug".into()),
                ("user_id".into(), format!("eq.{uid}")),
                ("order".into(), "created_at.asc".into()),
                ("limit".into(), "200".into()),
            ],
        )
        .await
        .unwrap_or_default();
    let books: Vec<String> = rows.iter().map(|r| s(&serde_json::Value::Object(r.clone()), "book_slug")).collect();
    serde_json::json!(books)
}
