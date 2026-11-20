//! The supa layer — the Rust port of lib/server/supa.ts. Two transports
//! behind one interface:
//!
//!   • Emu — the in-process Supabase emulator (SUPABASE_EMU=1): the same
//!     REST/auth semantics, no HTTP hop;
//!   • Http — the real Supabase project (PostgREST + GoTrue) with the
//!     service_role key, identical endpoints, filters and error strings.
//!
//! Every method mirrors its TS counterpart, including the
//! "supabase {status}: {body}" / "gotrue {status}: {body}" error text the
//! domain layers match on.

use crate::emu::EmuStore;
use crate::error::SupaError;
use crate::util::*;
use serde_json::{json, Value};
use std::sync::Arc;

pub type Params = Vec<(String, String)>;

/// Flexible params input: Vec / &Vec of (String, String) or &[(&str, &str)]
/// / &[(&str, &str); N] tuples all convert.
pub trait IntoParams {
    fn into_params(self) -> Params;
}

impl IntoParams for Vec<(String, String)> {
    fn into_params(self) -> Params {
        self
    }
}

impl<'a> IntoParams for &'a Vec<(String, String)> {
    fn into_params(self) -> Params {
        self.clone()
    }
}

impl<'a> IntoParams for &'a [(&'a str, &'a str)] {
    fn into_params(self) -> Params {
        self.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }
}

impl<'a, const N: usize> IntoParams for &'a [(&'a str, &'a str); N] {
    fn into_params(self) -> Params {
        self.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }
}

#[derive(Clone)]
pub enum Supa {
    Emu(Arc<EmuStore>),
    Http { rest: String, auth: String, key: String, client: reqwest::Client },
}

fn qs(params: &Params) -> String {
    build_query(params)
}

/// Defense-in-depth for every mutating call: each filter value must carry a
/// PostgREST operator prefix (`eq.`, `lt.`, `in.`, …). A bare value would be
/// silently DROPPED by the emulator's parser (→ an empty filter list matches
/// ALL rows — mass delete/update) and rejected by real PostgREST; fail loudly
/// instead so the bug can never ship again.
fn guard_filters(filters: &Params) -> Result<(), SupaError> {
    const OPS: &[&str] = &[
        "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "isnot", "in", "not",
        "contains", "overlaps", "cs", "cd", "sl", "sr", "nxl", "nxr", "adj", "fts", "plfts",
        "phfts", "wfts", "or", "and", "match",
    ];
    for (k, v) in filters {
        if matches!(k.as_str(), "select" | "order" | "limit" | "offset" | "on_conflict") {
            continue;
        }
        let ok = v
            .split_once('.')
            .map(|(op, _)| OPS.contains(&op))
            .unwrap_or(false);
        if !ok {
            return Err(SupaError::rest(
                500,
                format!("filter `{k}={v}` has no operator prefix — refusing unbounded mutation"),
            ));
        }
    }
    Ok(())
}

impl Supa {
    pub fn http(base: &str, key: &str, client: reqwest::Client) -> Self {
        let root = base.trim_end_matches('/');
        Supa::Http {
            rest: format!("{root}/rest/v1"),
            auth: format!("{root}/auth/v1"),
            key: key.to_string(),
            client,
        }
    }

    pub fn emu_enabled(&self) -> bool {
        matches!(self, Supa::Emu(_))
    }

    #[allow(dead_code)]
    pub fn emu_store(&self) -> Option<&Arc<EmuStore>> {
        match self {
            Supa::Emu(s) => Some(s),
            _ => None,
        }
    }

    /* ── PostgREST ─────────────────────────────────────────────────────── */

    /// SELECT — returns the row array.
    pub async fn select(&self, table: &str, params: impl IntoParams) -> Result<Vec<Row>, SupaError> {
        let params = params.into_params();
        match self {
            Supa::Emu(store) => Ok(store.rest_get(table, &params)),
            Supa::Http { rest, key, client, .. } => {
                let res = client
                    .get(format!("{rest}/{table}?{}", qs(&params)))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .send()
                    .await
                    .map_err(|e| SupaError::rest(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::rest(status, text));
                }
                let v: Value = serde_json::from_str(&text)
                    .map_err(|e| SupaError::rest(status, e.to_string()))?;
                Ok(v.as_array()
                    .map(|a| a.iter().filter_map(|r| r.as_object().cloned()).collect())
                    .unwrap_or_default())
            }
        }
    }

    /// SELECT one row (first match) or None — propagates transport
    /// errors like the TS client (supaSelectOne).
    pub async fn select_one(&self, table: &str, params: impl IntoParams) -> Result<Option<Row>, SupaError> {
        let mut all = params.into_params();
        all.push(("limit".into(), "1".into()));
        Ok(self.select(table, all).await?.into_iter().next())
    }

    /// INSERT one row — returns the created row (return=representation).
    pub async fn insert(&self, table: &str, body: &Value) -> Result<Option<Row>, SupaError> {
        match self {
            Supa::Emu(store) => Ok(store
                .rest_post(table, body)
                .ok_or_else(|| SupaError::rest(400, "invalid body".into()))?
                .into_iter()
                .next()),
            Supa::Http { rest, key, client, .. } => {
                let res = client
                    .post(format!("{rest}/{table}"))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .header("prefer", "return=representation")
                    .header("content-type", "application/json")
                    .body(serde_json::to_string(body).unwrap_or_default())
                    .send()
                    .await
                    .map_err(|e| SupaError::rest(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::rest(status, text));
                }
                let v: Value = serde_json::from_str(&text)
                    .map_err(|e| SupaError::rest(status, e.to_string()))?;
                Ok(v.as_array()
                    .and_then(|a| a.first())
                    .and_then(|r| r.as_object().cloned()))
            }
        }
    }

    /// PATCH rows matching the filters — the updated rows.
    pub async fn update(&self, table: &str, filters: &Params, body: &Value) -> Result<Vec<Row>, SupaError> {
        guard_filters(filters)?;
        match self {
            Supa::Emu(store) => {
                let body = body.as_object().cloned().unwrap_or_default();
                Ok(store.rest_patch(table, &body, filters))
            }
            Supa::Http { rest, key, client, .. } => {
                let res = client
                    .patch(format!("{rest}/{table}?{}", qs(filters)))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .header("prefer", "return=representation")
                    .header("content-type", "application/json")
                    .body(serde_json::to_string(body).unwrap_or_default())
                    .send()
                    .await
                    .map_err(|e| SupaError::rest(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::rest(status, text));
                }
                let v: Value = serde_json::from_str(&text)
                    .map_err(|e| SupaError::rest(status, e.to_string()))?;
                Ok(v.as_array()
                    .map(|a| a.iter().filter_map(|r| r.as_object().cloned()).collect())
                    .unwrap_or_default())
            }
        }
    }

    /// DELETE rows matching the filters.
    pub async fn delete(&self, table: &str, filters: &Params) -> Result<(), SupaError> {
        guard_filters(filters)?;
        match self {
            Supa::Emu(store) => {
                store.rest_delete(table, filters);
                Ok(())
            }
            Supa::Http { rest, key, client, .. } => {
                let res = client
                    .delete(format!("{rest}/{table}?{}", qs(filters)))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .send()
                    .await
                    .map_err(|e| SupaError::rest(0, e.to_string()))?;
                let status = res.status().as_u16();
                if !(200..300).contains(&status) && status != 404 {
                    let text = res.text().await.unwrap_or_default();
                    return Err(SupaError::rest(status, text));
                }
                Ok(())
            }
        }
    }

    /* ── GoTrue (Supabase Auth) ────────────────────────────────────────── */

    /// A user as GoTrue returns it: { id, email, user_metadata.full_name }.
    pub fn user_from_auth(row: &Value) -> Option<(String, String, Option<String>)> {
        let id = row.get("id")?.as_str()?.to_string();
        let email = row.get("email")?.as_str()?.to_string();
        let name = row
            .pointer("/user_metadata/full_name")
            .and_then(|v| v.as_str())
            .map(String::from);
        Some((id, email, name))
    }

    /// True when the GoTrue user row is an e-mail-confirmed account.
    pub fn is_confirmed_user(u: &Value) -> bool {
        if u.get("email_confirmed") == Some(&json!(true)) {
            return true;
        }
        let at = u
            .get("email_confirmed_at")
            .or_else(|| u.get("confirmed_at"))
            .and_then(|v| v.as_str())
            .map(|s| !s.is_empty())
            .unwrap_or(false);
        at
    }

    /// Admin create user — 422 = e-mail taken (the error text carries it).
    pub async fn admin_create_user(
        &self,
        email: &str,
        password: &str,
        full_name: &str,
        email_confirm: bool,
        extra_metadata: &Value,
    ) -> Result<Value, SupaError> {
        let body = json!({
            "email": email,
            "password": password,
            "email_confirm": email_confirm,
            "user_metadata": merge_meta(full_name, extra_metadata),
        });
        match self {
            Supa::Emu(store) => store
                .admin_create_user(email, password, full_name, email_confirm, extra_metadata)
                .map_err(|(status, body)| SupaError::gotrue(status, body)),
            Supa::Http { auth, key, client, .. } => {
                let res = client
                    .post(format!("{auth}/admin/users"))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .header("content-type", "application/json")
                    .body(serde_json::to_string(&body).unwrap_or_default())
                    .send()
                    .await
                    .map_err(|e| SupaError::gotrue(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::gotrue(status, text));
                }
                serde_json::from_str(&text).map_err(|e| SupaError::gotrue(status, e.to_string()))
            }
        }
    }

    /// Admin fetch — one auth user by id.
    pub async fn admin_get_user(&self, id: &str) -> Result<Value, SupaError> {
        match self {
            Supa::Emu(store) => store
                .admin_get_user(id)
                .ok_or_else(|| SupaError::gotrue(404, r#"{"code":404,"msg":"User not found"}"#.into())),
            Supa::Http { auth, key, client, .. } => {
                let res = client
                    .get(format!("{auth}/admin/users/{id}"))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .send()
                    .await
                    .map_err(|e| SupaError::gotrue(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::gotrue(status, text));
                }
                serde_json::from_str(&text).map_err(|e| SupaError::gotrue(status, e.to_string()))
            }
        }
    }

    /// Find one auth user by exact e-mail (case-insensitive), or None.
    pub async fn admin_find_user_by_email(&self, email: &str) -> Option<Row> {
        let mail = email.trim().to_lowercase();
        if mail.is_empty() {
            return None;
        }
        match self {
            Supa::Emu(store) => store
                .find_user_by_email(&mail)
                .and_then(|v| v.as_object().cloned()),
            Supa::Http { auth, key, client, .. } => {
                async fn try_list(
                    client: &reqwest::Client,
                    auth: &str,
                    key: &str,
                    query: String,
                ) -> Option<Vec<Value>> {
                    let res = client
                        .get(format!("{auth}/admin/users?{query}"))
                        .header("apikey", key)
                        .header("authorization", format!("Bearer {key}"))
                        .send()
                        .await
                        .ok()?;
                    if !res.status().is_success() {
                        return None;
                    }
                    let text = res.text().await.ok()?;
                    let v: Value = serde_json::from_str(&text).ok()?;
                    v.get("users").and_then(|u| u.as_array().cloned())
                }
                // Primary: exact-match emails filter (supported by hosted
                // GoTrue; ignored by stock — we exact-match locally anyway).
                if let Some(users) =
                    try_list(client, auth, key, format!("emails={}&per_page=1", uri_encode(&mail))).await
                {
                    if let Some(hit) = users
                        .iter()
                        .find(|u| u.get("email").and_then(|e| e.as_str()) == Some(mail.as_str()))
                    {
                        return hit.as_object().cloned();
                    }
                }
                // Second: the dashboard-style `query` search (supported by
                // hosted GoTrue, ignored by stock — then it just lists page 1
                // and the local exact match still filters it).
                if let Some(users) =
                    try_list(client, auth, key, format!("query={}&per_page=50", uri_encode(&mail))).await
                {
                    if let Some(hit) = users
                        .iter()
                        .find(|u| u.get("email").and_then(|e| e.as_str()) == Some(mail.as_str()))
                    {
                        return hit.as_object().cloned();
                    }
                }
                // Last resort: page through the WHOLE directory — a 50-row
                // window would silently hide every later user and make them
                // permanently unloginnable.
                let per_page = 200;
                let mut page = 1u32;
                loop {
                    let Some(users) = try_list(
                        client,
                        auth,
                        key,
                        format!("page={page}&per_page={per_page}"),
                    )
                    .await
                    else {
                        return None;
                    };
                    if let Some(hit) = users
                        .iter()
                        .find(|u| u.get("email").and_then(|e| e.as_str()) == Some(mail.as_str()))
                    {
                        return hit.as_object().cloned();
                    }
                    if users.len() < per_page {
                        return None;
                    }
                    page += 1;
                }
            }
        }
    }

    /// Admin update — { email_confirm: true } or new user_metadata.
    pub async fn admin_update_user(&self, id: &str, patch: &Value) -> Result<Value, SupaError> {
        match self {
            Supa::Emu(store) => store
                .admin_update_user(id, patch)
                .map_err(|(status, body)| SupaError::gotrue(status, body)),
            Supa::Http { auth, key, client, .. } => {
                let res = client
                    .put(format!("{auth}/admin/users/{id}"))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .header("content-type", "application/json")
                    .body(serde_json::to_string(patch).unwrap_or_default())
                    .send()
                    .await
                    .map_err(|e| SupaError::gotrue(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::gotrue(status, text));
                }
                serde_json::from_str(&text).map_err(|e| SupaError::gotrue(status, e.to_string()))
            }
        }
    }

    /// Admin delete — 404 counts as success.
    pub async fn admin_delete_user(&self, id: &str) -> Result<(), SupaError> {
        match self {
            Supa::Emu(store) => store
                .admin_delete_user(id)
                .map_err(|(status, body)| SupaError::gotrue(status, body)),
            Supa::Http { auth, key, client, .. } => {
                let res = client
                    .delete(format!("{auth}/admin/users/{id}"))
                    .header("apikey", key)
                    .header("authorization", format!("Bearer {key}"))
                    .send()
                    .await
                    .map_err(|e| SupaError::gotrue(0, e.to_string()))?;
                let status = res.status().as_u16();
                if !(200..300).contains(&status) && status != 404 {
                    let text = res.text().await.unwrap_or_default();
                    return Err(SupaError::gotrue(status, text));
                }
                Ok(())
            }
        }
    }

    /// Password grant — verifies credentials against auth.users.
    pub async fn password_login(&self, email: &str, password: &str) -> Result<Value, SupaError> {
        match self {
            Supa::Emu(store) => store
                .password_login(email, password)
                .map_err(|(status, body)| SupaError::gotrue(status, body)),
            Supa::Http { auth, key, client, .. } => {
                let res = client
                    .post(format!("{auth}/token?grant_type=password"))
                    .header("apikey", key)
                    .header("content-type", "application/json")
                    .body(serde_json::to_string(&json!({ "email": email, "password": password })).unwrap_or_default())
                    .send()
                    .await
                    .map_err(|e| SupaError::gotrue(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::gotrue(status, text));
                }
                serde_json::from_str(&text).map_err(|e| SupaError::gotrue(status, e.to_string()))
            }
        }
    }

    /// PKCE code exchange — completes the OAuth flow.
    pub async fn pkce_exchange(&self, auth_code: &str, code_verifier: &str) -> Result<Value, SupaError> {
        match self {
            Supa::Emu(_) => {
                // Handled by routes/emu.rs (the code map lives in AppState);
                // the in-process caller never takes this path.
                Err(SupaError::gotrue(400, "pkce handled at route layer".into()))
            }
            Supa::Http { auth, key, client, .. } => {
                let res = client
                    .post(format!("{auth}/token?grant_type=pkce"))
                    .header("apikey", key)
                    .header("content-type", "application/json")
                    .body(
                        serde_json::to_string(&json!({
                            "auth_code": auth_code,
                            "code_verifier": code_verifier,
                        }))
                        .unwrap_or_default(),
                    )
                    .send()
                    .await
                    .map_err(|e| SupaError::gotrue(0, e.to_string()))?;
                let status = res.status().as_u16();
                let text = res.text().await.unwrap_or_default();
                if !(200..300).contains(&status) {
                    return Err(SupaError::gotrue(status, text));
                }
                serde_json::from_str(&text).map_err(|e| SupaError::gotrue(status, e.to_string()))
            }
        }
    }
}

fn merge_meta(full_name: &str, extra: &Value) -> Value {
    let mut m = extra.as_object().cloned().unwrap_or_default();
    m.insert("full_name".into(), json!(full_name));
    Value::Object(m)
}
