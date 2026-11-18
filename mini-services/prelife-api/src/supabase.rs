use reqwest::Client;
use serde_json::{json, Value};

/// Minimal PostgREST + GoTrue client for Supabase using the service_role
/// key (bypasses RLS). All queries return raw JSON rows.
pub struct Supa {
    client: Client,
    base: String,
    auth_base: String,
    key: String,
    configured: bool,
}

impl Supa {
    pub fn new(url: &str, key: &str) -> Self {
        let root = url.trim_end_matches('/');
        let configured = !root.is_empty() && !key.is_empty();
        Self {
            client: Client::new(),
            base: format!("{}/rest/v1", root),
            auth_base: format!("{}/auth/v1", root),
            key: key.to_string(),
            configured,
        }
    }

    /// False when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY were not set —
    /// the service then runs degraded (see main.rs) and answers 503
    /// `supabase_unconfigured` instead of failing with vague 500s.
    pub fn is_configured(&self) -> bool {
        self.configured
    }

    fn auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        req.header("apikey", &self.key)
            .header("authorization", format!("Bearer {}", self.key))
    }

    /// SELECT — returns the row array.
    pub async fn select(
        &self,
        table: &str,
        params: &[(&str, &str)],
    ) -> Result<Vec<Value>, String> {
        let mut req = self.auth(self.client.get(format!("{}/{}", self.base, table)));
        for (k, v) in params {
            req = req.query(&[(k, v)]);
        }
        let res = req.send().await.map_err(|e| format!("request: {e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("body: {e}"))?;
        if !status.is_success() {
            return Err(format!("supabase {status}: {text}"));
        }
        let v: Value = serde_json::from_str(&text).map_err(|e| format!("json: {e}"))?;
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// SELECT one row (first match).
    pub async fn select_one(
        &self,
        table: &str,
        params: &[(&str, &str)],
    ) -> Result<Option<Value>, String> {
        let mut p = params.to_vec();
        p.push(("limit", "1"));
        let rows = self.select(table, &p).await?;
        Ok(rows.into_iter().next())
    }

    /// INSERT one row — returns the created row (Prefer: return=representation).
    pub async fn insert(&self, table: &str, body: &Value) -> Result<Value, String> {
        let req = self
            .auth(self.client.post(format!("{}/{}", self.base, table)))
            .header("prefer", "return=representation")
            .json(body);
        let res = req.send().await.map_err(|e| format!("request: {e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("body: {e}"))?;
        if !status.is_success() {
            return Err(format!("supabase {status}: {text}"));
        }
        let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        Ok(v.as_array().and_then(|a| a.first().cloned()).unwrap_or(Value::Null))
    }

    /// PATCH rows matching the filters — returns the updated rows.
    pub async fn update(
        &self,
        table: &str,
        filters: &[(&str, &str)],
        body: &Value,
    ) -> Result<Vec<Value>, String> {
        let mut req = self
            .auth(self.client.patch(format!("{}/{}", self.base, table)))
            .header("prefer", "return=representation")
            .json(body);
        for (k, v) in filters {
            req = req.query(&[(k, v)]);
        }
        let res = req.send().await.map_err(|e| format!("request: {e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("body: {e}"))?;
        if !status.is_success() {
            return Err(format!("supabase {status}: {text}"));
        }
        let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        Ok(v.as_array().cloned().unwrap_or_default())
    }

    /// DELETE rows matching the filters.
    pub async fn delete(&self, table: &str, filters: &[(&str, &str)]) -> Result<(), String> {
        let mut req = self.auth(self.client.delete(format!("{}/{}", self.base, table)));
        for (k, v) in filters {
            req = req.query(&[(k, v)]);
        }
        let res = req.send().await.map_err(|e| format!("request: {e}"))?;
        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(format!("supabase {status}: {text}"));
        }
        Ok(())
    }

    /* ── GoTrue (Supabase Auth) — login verification lives in the DB ───── */

    /// Create a confirmed auth user via the admin API. The
    /// `handle_new_user` trigger on auth.users makes the profiles row.
    /// Returns the created user (id, email, user_metadata, …) or a
    /// "gotrue <status>: <body>" error string (422 = email taken).
    pub async fn auth_admin_create_user(
        &self,
        email: &str,
        password: &str,
        full_name: &str,
    ) -> Result<Value, String> {
        let res = self
            .client
            .post(format!("{}/admin/users", self.auth_base))
            .header("apikey", &self.key)
            .header("authorization", format!("Bearer {}", self.key))
            .json(&json!({
                "email": email,
                "password": password,
                "email_confirm": true,
                "user_metadata": { "full_name": full_name },
            }))
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("body: {e}"))?;
        if !status.is_success() {
            return Err(format!("gotrue {status}: {text}"));
        }
        serde_json::from_str(&text).map_err(|e| format!("json: {e}"))
    }

    /// Password grant — verifies the credentials against auth.users in the
    /// database. 200 returns { access_token, refresh_token, user }, a 400
    /// with error "invalid_grant" means wrong email/password.
    pub async fn auth_password_login(&self, email: &str, password: &str) -> Result<Value, String> {
        let res = self
            .client
            .post(format!("{}/token?grant_type=password", self.auth_base))
            .header("apikey", &self.key)
            .json(&json!({ "email": email, "password": password }))
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;
        let status = res.status();
        let text = res.text().await.map_err(|e| format!("body: {e}"))?;
        if !status.is_success() {
            return Err(format!("gotrue {status}: {text}"));
        }
        serde_json::from_str(&text).map_err(|e| format!("json: {e}"))
    }
}
