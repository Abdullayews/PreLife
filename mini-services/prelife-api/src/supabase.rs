use reqwest::Client;
use serde_json::Value;

/// Minimal PostgREST client for Supabase using the service_role key
/// (bypasses RLS). All queries return raw JSON rows.
pub struct Supa {
    client: Client,
    base: String,
    key: String,
}

impl Supa {
    pub fn new(url: &str, key: &str) -> Self {
        Self {
            client: Client::new(),
            base: format!("{}/rest/v1", url.trim_end_matches('/')),
            key: key.to_string(),
        }
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
}
