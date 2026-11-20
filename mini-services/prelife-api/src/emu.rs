//! The local Supabase emulator — the Rust port of lib/server/emu (store +
//! seed). DEV ONLY (SUPABASE_EMU=1): content tables re-seeded from
//! db/seed-content.sql on every boot, user-data tables persisted to
//! db/emu-store.json (debounced write-through), auth.users as the
//! `auth_users` array with GoTrue-shaped responses.
//!
//! The REST filter/sort/limit semantics are shared by the HTTP surface
//! (routes/emu.rs) and the in-process supa client (supa.rs), so both see
//! exactly what the Next.js emulator served.

use crate::util::*;
use crate::AiPromptSeed;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, RwLock};

pub const PERSISTED_TABLES: &[&str] = &[
    "sessions", "profiles", "journal_entries_v2", "mood_logs", "quiz_results",
    "meditation_progress", "appointments", "user_weight_logs", "custom_packages",
    "user_plans", "email_verifications", "mail_outbox", "ai_settings", "ai_prompts",
];

pub const DEMO_EMAIL: &str = "muhemmed@prelife.net";
pub const DEMO_PASSWORD: &str = "prelife123";

#[derive(Default)]
pub struct EmuData {
    pub auth_users: Vec<Row>,
    pub tables: HashMap<String, Vec<Row>>,
}

pub struct EmuStore {
    data: RwLock<EmuData>,
    root: PathBuf,
    tx: Mutex<Option<tokio::sync::mpsc::UnboundedSender<()>>>,
}

/* ── row helpers ───────────────────────────────────────────────────────── */

fn now_iso() -> String {
    crate::util::now_iso()
}

/// A row borrowed as a Value (works for &Row and &&Row via deref).
fn row_v(u: &Row) -> Value {
    Value::Object(u.clone())
}

pub fn hash_password(pw: &str) -> String {
    hash_password_salted(pw, &uuid_v4()[..8])
}

pub fn hash_password_salted(pw: &str, salt: &str) -> String {
    format!("{salt}${}", sha256_hex(&format!("{salt}{pw}")))
}

pub fn verify_password(pw: &str, stored: &str) -> bool {
    match stored.split_once('$') {
        Some((salt, _)) => hash_password_salted(pw, salt) == stored,
        None => false,
    }
}

/// The GoTrue-shaped user the admin endpoints return.
pub fn gotrue_user(u: &Row) -> Value {
    let app_meta = u
        .get("app_metadata")
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_else(|| {
            let mut m = Map::new();
            m.insert("provider".into(), json!("email"));
            m.insert("providers".into(), json!(["email"]));
            m
        });
    let confirmed = u.get("email_confirmed").map(|v| v == &json!(true)).unwrap_or(false);
    let created = u.get("created_at").cloned().unwrap_or(Value::Null);
    json!({
        "id": u.get("id").cloned().unwrap_or(Value::Null),
        "aud": "authenticated",
        "role": "authenticated",
        "email": u.get("email").cloned().unwrap_or(Value::Null),
        "phone": "",
        "email_confirmed": confirmed,
        "confirmed_at": if confirmed { created.clone() } else { Value::Null },
        "last_sign_in_at": u.get("last_sign_in_at").cloned().unwrap_or(Value::Null),
        "user_metadata": u.get("user_metadata").cloned().unwrap_or(json!({})),
        "app_metadata": Value::Object(app_meta),
        "created_at": created,
        "updated_at": u.get("updated_at").or(u.get("created_at")).cloned().unwrap_or(Value::Null),
    })
}

impl EmuStore {
    /// Boot: seed content tables, restore persisted user data, seed base rows.
    pub fn boot(root: PathBuf, prompt_seeds: &[AiPromptSeed], gemini_key: &str, gemini_model: &str) -> Self {
        let persisted: Value = std::fs::read_to_string(root.join("db/emu-store.json"))
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or(json!({}));

        let mut data = EmuData::default();
        data.tables = build_content_tables(&root);

        for t in PERSISTED_TABLES {
            let rows = persisted
                .pointer(&format!("/tables/{t}"))
                .and_then(|v| v.as_array().cloned())
                .unwrap_or_default()
                .into_iter()
                .filter_map(|v| v.as_object().cloned())
                .collect();
            data.tables.insert(t.to_string(), rows);
        }
        data.auth_users = persisted
            .get("authUsers")
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default()
            .into_iter()
            .filter_map(|v| v.as_object().cloned())
            .collect();

        // Secret hygiene: the emu REST surface is intentionally open, so the
        // live Gemini key must NEVER sit in the readable ai_settings row —
        // mask it here (covers stores persisted by older builds too).
        if !gemini_key.is_empty() {
            if let Some(rows) = data.tables.get_mut("ai_settings") {
                for row in rows.iter_mut() {
                    if row.get("api_key").and_then(|k| k.as_str()) == Some(gemini_key) {
                        row.insert("api_key".into(), json!("(env GEMINI_API_KEY)"));
                    }
                }
            }
        }

        seed_base_rows(&mut data, prompt_seeds, gemini_key, gemini_model);

        let store = Self {
            data: RwLock::new(data),
            root,
            tx: Mutex::new(None),
        };
        store
    }

    /// Wire the debounced persist task (called once from main).
    pub fn start_persist_task(self: &std::sync::Arc<Self>) {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<()>();
        *self.tx.lock().unwrap() = Some(tx);
        let store = self.clone();
        tokio::spawn(async move {
            loop {
                if rx.recv().await.is_none() {
                    break;
                }
                // Debounce: keep pushing the deadline while writes arrive.
                let mut deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(400);
                loop {
                    tokio::select! {
                        _ = rx.recv() => {
                            deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(400);
                        }
                        _ = tokio::time::sleep_until(deadline) => break,
                    }
                }
                store.persist_now();
            }
        });
    }

    fn mark_persist(&self) {
        if let Some(tx) = self.tx.lock().unwrap().as_ref() {
            let _ = tx.send(());
        }
    }

    /// Write the persisted tables to db/emu-store.json.
    pub fn persist_now(&self) {
        let data = self.data.read().unwrap();
        let mut tables = Map::new();
        for t in PERSISTED_TABLES {
            let rows: Vec<Value> = data
                .tables
                .get(*t)
                .map(|v| v.iter().map(|r| Value::Object(r.clone())).collect())
                .unwrap_or_default();
            tables.insert(t.to_string(), json!(rows));
        }
        let out = json!({
            "version": 1,
            "authUsers": data.auth_users.iter().map(|r| Value::Object(r.clone())).collect::<Vec<_>>(),
            "tables": tables,
        });
        if let Some(dir) = self.root.join("db").to_str().map(|s| s.to_string()) {
            let _ = std::fs::create_dir_all(&dir);
        }
        if let Err(e) = std::fs::write(
            self.root.join("db/emu-store.json"),
            serde_json::to_string(&out).unwrap_or_default(),
        ) {
            eprintln!("[emu] persist failed: {e}");
        }
    }

    /* ── REST semantics (shared by the HTTP routes and the supa client) ── */

    pub fn rest_get(&self, table: &str, query: &[(String, String)]) -> Vec<Row> {
        let data = self.data.read().unwrap();
        let rows = data.tables.get(table).cloned().unwrap_or_default();
        drop(data);
        let mut out = filter_rows(rows, query);
        sort_rows_in_place(&mut out, query_get(query, "order"));
        if let Some(off) = query_get(query, "offset").and_then(|v| v.parse::<usize>().ok()) {
            if off > 0 {
                out = out.into_iter().skip(off).collect();
            }
        }
        if let Some(lim) = query_get(query, "limit").and_then(|v| v.parse::<usize>().ok()) {
            if lim > 0 {
                out.truncate(lim);
            }
        }
        out
    }

    /// Insert an object or array — Some(created) or None on an invalid body.
    pub fn rest_post(&self, table: &str, body: &Value) -> Option<Vec<Row>> {
        let list: Vec<&Value> = match body {
            Value::Array(a) => a.iter().collect(),
            Value::Object(_) => vec![body],
            _ => return None,
        };
        if list.is_empty() || list.iter().any(|r| !r.is_object()) {
            return None;
        }
        let mut data = self.data.write().unwrap();
        let rows = data.tables.entry(table.to_string()).or_default();
        let now = now_iso();
        let mut created = Vec::new();
        for raw in list {
            let mut row = raw.as_object().cloned().unwrap();
            let missing_id = row
                .get("id")
                .map(|v| v.is_null() || v == &json!(""))
                .unwrap_or(true);
            if missing_id {
                row.insert("id".into(), json!(uuid_v4()));
            }
            if !row.contains_key("created_at") {
                row.insert("created_at".into(), json!(now));
            }
            if !row.contains_key("updated_at") {
                row.insert("updated_at".into(), row.get("created_at").cloned().unwrap_or(json!(now)));
            }
            rows.push(row.clone());
            created.push(row);
        }
        drop(data);
        self.mark_persist();
        Some(created)
    }

    /// PATCH rows matching the filters — the updated rows.
    pub fn rest_patch(&self, table: &str, body: &Row, query: &[(String, String)]) -> Vec<Row> {
        let mut data = self.data.write().unwrap();
        let Some(rows) = data.tables.get_mut(table) else { return vec![] };
        let targets = filter_indices(rows, query);
        let now = now_iso();
        let mut updated = Vec::new();
        for idx in targets {
            let row = &mut rows[idx];
            for (k, v) in body {
                row.insert(k.clone(), v.clone());
            }
            row.insert("updated_at".into(), json!(now));
            updated.push(row.clone());
        }
        drop(data);
        self.mark_persist();
        updated
    }

    /// DELETE rows matching the filters.
    pub fn rest_delete(&self, table: &str, query: &[(String, String)]) {
        let mut data = self.data.write().unwrap();
        let Some(rows) = data.tables.get_mut(table) else { return };
        let doomed = filter_indices(rows, query);
        if doomed.is_empty() {
            return;
        }
        for idx in doomed.into_iter().rev() {
            rows.remove(idx);
        }
        drop(data);
        self.mark_persist();
    }

    /// The emuInsert helper (id + timestamps when missing) — returns the row.
    #[allow(dead_code)]
    pub fn insert(&self, table: &str, body: Row) -> Row {
        self.rest_post(table, &Value::Object(body))
            .and_then(|v| v.into_iter().next())
            .unwrap_or_default()
    }

    /* ── GoTrue admin / token semantics ────────────────────────────────── */

    /// Admin create — 422 on a taken e-mail, else the GoTrue user shape.
    pub fn admin_create_user(&self, email: &str, password: &str, full_name: &str, email_confirm: bool, extra_meta: &Value) -> Result<Value, (u16, String)> {
        let email = email.trim().to_lowercase();
        if email.is_empty() || password.is_empty() {
            return Err((400, json_str(&json!({"message": "email and password required"}))));
        }
        let mut data = self.data.write().unwrap();
        if data.auth_users.iter().any(|u| s(&row_v(u), "email") == email) {
            return Err((422, json_str(&json!({"code": 422, "msg": "A user with this email address has already been registered"}))));
        }
        let now = now_iso();
        let mut meta = extra_meta.as_object().cloned().unwrap_or_default();
        meta.insert("full_name".into(), json!(full_name));
        let id = uuid_v4();
        let mut user = Row::new();
        user.insert("id".into(), json!(id));
        user.insert("email".into(), json!(email));
        user.insert("pass_hash".into(), json!(hash_password(password)));
        user.insert("email_confirmed".into(), json!(email_confirm));
        user.insert("user_metadata".into(), Value::Object(meta));
        user.insert("created_at".into(), json!(now));
        user.insert("updated_at".into(), json!(now));
        user.insert("last_sign_in_at".into(), Value::Null);
        data.auth_users.push(user.clone());

        // handle_new_user trigger: the profiles row
        let mut profile = Row::new();
        profile.insert("id".into(), json!(id));
        profile.insert("full_name".into(), if full_name.is_empty() { Value::Null } else { json!(full_name) });
        for (k, v) in [
            ("username", Value::Null), ("avatar_url", Value::Null), ("lang", json!("en")),
            ("theme", json!("light")), ("rail_folded", json!(false)),
            ("plan_onboarding_done", json!(false)), ("fitness_level", Value::Null),
            ("workouts_per_week", Value::Null), ("reading_goal_books_per_year", Value::Null),
            ("gender", Value::Null), ("birth_year", Value::Null), ("height_cm", Value::Null),
            ("goal", Value::Null), ("activity_level", Value::Null),
        ] {
            profile.insert(k.into(), v);
        }
        profile.insert("created_at".into(), json!(now));
        profile.insert("updated_at".into(), json!(now));
        data.tables.entry("profiles".into()).or_default().push(profile);
        drop(data);
        self.mark_persist();
        Ok(gotrue_user(&user))
    }

    pub fn admin_get_user(&self, id: &str) -> Option<Value> {
        self.data
            .read()
            .unwrap()
            .auth_users
            .iter()
            .find(|u| s(&row_v(u), "id") == id)
            .map(gotrue_user)
    }

    /// The admin list endpoint (emails exact-match / filter substring) —
    /// GoTrue-shaped users.
    pub fn admin_list_users(&self, emails: &[String], filter: &str) -> Vec<Value> {
        self.data
            .read()
            .unwrap()
            .auth_users
            .iter()
            .filter(|u| {
                let email = s(&row_v(u), "email").to_lowercase();
                if !emails.is_empty() {
                    emails.iter().any(|e| e == &email)
                } else if !filter.is_empty() {
                    email.contains(filter)
                } else {
                    true
                }
            })
            .map(gotrue_user)
            .collect()
    }

    /// Exact-match e-mail lookup (lower-cased) — the emails= filter path.
    pub fn find_user_by_email(&self, email: &str) -> Option<Value> {
        let mail = email.trim().to_lowercase();
        if mail.is_empty() {
            return None;
        }
        self.data
            .read()
            .unwrap()
            .auth_users
            .iter()
            .find(|u| s(&row_v(u), "email").to_lowercase() == mail)
            .map(|u| Value::Object(u.clone()))
    }

    /// Admin update — email_confirm / password / merged user_metadata.
    pub fn admin_update_user(&self, id: &str, patch: &Value) -> Result<Value, (u16, String)> {
        let mut data = self.data.write().unwrap();
        let Some(user) = data.auth_users.iter_mut().find(|u| s(&row_v(u), "id") == id) else {
            return Err((404, json_str(&json!({"code": 404, "msg": "User not found"}))));
        };
        if let Some(v) = patch.get("email_confirm").and_then(|v| v.as_bool()) {
            user.insert("email_confirmed".into(), json!(v));
        }
        if let Some(pw) = patch.get("password").and_then(|v| v.as_str()) {
            if !pw.is_empty() {
                user.insert("pass_hash".into(), json!(hash_password(pw)));
            }
        }
        let mut full_name_to_apply: Option<String> = None;
        if let Some(meta) = patch.get("user_metadata").and_then(|v| v.as_object()) {
            let mut merged = user
                .get("user_metadata")
                .and_then(|v| v.as_object().cloned())
                .unwrap_or_default();
            for (k, v) in meta {
                merged.insert(k.clone(), v.clone());
            }
            user.insert("user_metadata".into(), Value::Object(merged));
            if let Some(name) = user.get("user_metadata").and_then(|m| m.get("full_name")).and_then(|v| v.as_str()) {
                full_name_to_apply = Some(name.to_string());
            }
        }
        user.insert("updated_at".into(), json!(now_iso()));
        let out = gotrue_user(user);
        drop(user);
        if let Some(name) = full_name_to_apply {
            if let Some(profiles) = data.tables.get_mut("profiles") {
                if let Some(p) = profiles.iter_mut().find(|p| s(&row_v(p), "id") == id) {
                    p.insert("full_name".into(), json!(name));
                }
            }
        }
        drop(data);
        self.mark_persist();
        Ok(out)
    }

    /// Admin delete — cascades profiles / sessions / email_verifications.
    pub fn admin_delete_user(&self, id: &str) -> Result<(), (u16, String)> {
        let mut data = self.data.write().unwrap();
        let idx = data.auth_users.iter().position(|u| s(&row_v(u), "id") == id);
        let Some(idx) = idx else {
            return Err((404, json_str(&json!({"code": 404, "msg": "User not found"}))));
        };
        data.auth_users.remove(idx);
        for table in ["profiles", "sessions", "email_verifications"] {
            if let Some(rows) = data.tables.get_mut(table) {
                rows.retain(|r| {
                    let uid = s(&Value::Object(r.clone()), "user_id");
                    let rid = s(&Value::Object(r.clone()), "id");
                    uid != id && rid != id
                });
            }
        }
        drop(data);
        self.mark_persist();
        Ok(())
    }

    /// Password grant — GoTrue's success shape or the 400 error contract.
    pub fn password_login(&self, email: &str, password: &str) -> Result<Value, (u16, String)> {
        let email = email.trim().to_lowercase();
        let mut data = self.data.write().unwrap();
        let user = data
            .auth_users
            .iter_mut()
            .find(|u| s(&row_v(u), "email") == email);
        let Some(user) = user else {
            return Err((400, json_str(&json!({"error": "invalid_grant", "error_description": "Invalid login credentials"}))));
        };
        let stored = s(&Value::Object(user.clone()), "pass_hash");
        if !verify_password(password, &stored) {
            return Err((400, json_str(&json!({"error": "invalid_grant", "error_description": "Invalid login credentials"}))));
        }
        if user.get("email_confirmed") != Some(&json!(true)) {
            return Err((400, json_str(&json!({"error": "invalid_grant", "error_description": "Email not confirmed"}))));
        }
        user.insert("last_sign_in_at".into(), json!(now_iso()));
        let out = gotrue_user(user);
        drop(data);
        self.mark_persist();
        Ok(json!({
            "access_token": format!("emu-{}", uuid_v4()),
            "token_type": "bearer",
            "expires_in": 3600,
            "refresh_token": format!("emu-refresh-{}", uuid_v4()),
            "user": out,
        }))
    }

    /// Find-or-link-or-create the auth user behind a provider consent.
    pub fn oauth_upsert_user(&self, provider: &str, email: &str) -> Value {
        let identity = match provider {
            "google" => ("google.user@emu.prelife.dev", "Google User"),
            "apple" => ("apple.user@emu.prelife.dev", "Apple User"),
            _ => ("", "OAuth User"),
        };
        let mut data = self.data.write().unwrap();
        let now = now_iso();
        if let Some(existing) = data
            .auth_users
            .iter_mut()
            .find(|u| s(&row_v(u), "email") == email)
        {
            let mut meta = existing
                .get("app_metadata")
                .and_then(|v| v.as_object().cloned())
                .unwrap_or_else(|| {
                    let mut m = Map::new();
                    m.insert("provider".into(), json!("email"));
                    m.insert("providers".into(), json!(["email"]));
                    m
                });
            let mut providers: Vec<String> = meta
                .get("providers")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default();
            if !providers.iter().any(|p| p == provider) {
                providers.push(provider.to_string());
            }
            meta.insert("providers".into(), json!(providers));
            meta.insert("provider".into(), json!(provider));
            existing.insert("app_metadata".into(), Value::Object(meta));
            existing.insert("updated_at".into(), json!(now));
            let out = Value::Object(existing.clone());
            drop(data);
            self.mark_persist();
            return out;
        }

        let id = uuid_v4();
        let mut user = Row::new();
        user.insert("id".into(), json!(id));
        user.insert("email".into(), json!(email));
        user.insert("pass_hash".into(), json!(hash_password(&uuid_v4())));
        user.insert("email_confirmed".into(), json!(true));
        user.insert("user_metadata".into(), json!({ "full_name": identity.1 }));
        user.insert("app_metadata".into(), json!({ "provider": provider, "providers": [provider] }));
        user.insert("created_at".into(), json!(now));
        user.insert("updated_at".into(), json!(now));
        user.insert("last_sign_in_at".into(), Value::Null);
        data.auth_users.push(user.clone());

        let mut profile = Row::new();
        profile.insert("id".into(), json!(id));
        profile.insert("full_name".into(), json!(identity.1));
        for (k, v) in [
            ("username", Value::Null), ("avatar_url", Value::Null), ("lang", json!("en")),
            ("theme", json!("light")), ("rail_folded", json!(false)),
            ("plan_onboarding_done", json!(false)), ("fitness_level", Value::Null),
            ("workouts_per_week", Value::Null), ("reading_goal_books_per_year", Value::Null),
            ("gender", Value::Null), ("birth_year", Value::Null), ("height_cm", Value::Null),
            ("goal", Value::Null), ("activity_level", Value::Null),
        ] {
            profile.insert(k.into(), v);
        }
        profile.insert("created_at".into(), json!(now));
        profile.insert("updated_at".into(), json!(now));
        data.tables.entry("profiles".into()).or_default().push(profile);
        drop(data);
        self.mark_persist();
        Value::Object(user)
    }
}

fn json_str(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_default()
}

/* ── REST filter / sort (ports of the Next.js emu route helpers) ───────── */

const RESERVED: &[&str] = &["select", "order", "limit", "offset"];

#[derive(Clone, Copy, PartialEq)]
enum Op {
    Eq,
    Neq,
    Lt,
    Lte,
    Gt,
    Gte,
    Is,
    In,
}

fn parse_filter(raw: &str) -> Option<(Op, &str)> {
    for (p, op) in [
        ("gte.", Op::Gte), ("lte.", Op::Lte), ("neq.", Op::Neq), ("eq.", Op::Eq),
        ("gt.", Op::Gt), ("lt.", Op::Lt), ("is.", Op::Is), ("in.", Op::In),
    ] {
        if let Some(rest) = raw.strip_prefix(p) {
            return Some((op, rest));
        }
    }
    None
}

fn js_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::Null => "null".to_string(),
        _ => String::new(),
    }
}

fn loose_eq(row_val: Option<&Value>, raw: &str) -> bool {
    let Some(v) = row_val else { return false };
    match v {
        Value::Number(n) => match raw.parse::<f64>() {
            Ok(parsed) => n.as_f64() == Some(parsed),
            Err(_) => js_string(v) == raw,
        },
        Value::Bool(b) => *b == (raw == "true"),
        Value::String(s) => s == raw,
        _ => false,
    }
}

fn matches_op(row: &Row, col: &str, op: Op, raw: &str) -> bool {
    let v = row.get(col);
    match op {
        Op::Is => {
            let want = if raw == "null" {
                Value::Null
            } else if raw == "true" {
                json!(true)
            } else if raw == "false" {
                json!(false)
            } else {
                json!(raw)
            };
            v == Some(&want) || (v.is_none() && raw == "null")
        }
        Op::In => {
            let inner = raw.trim_start_matches('(').trim_end_matches(')');
            inner.split(',').map(|s| s.trim()).any(|o| loose_eq(v, o))
        }
        Op::Eq => loose_eq(v, raw),
        Op::Neq => !loose_eq(v, raw),
        _ => {
            // ordered ops
            let Some(v) = v else { return false };
            match v {
                Value::Number(n) => {
                    let Some(parsed) = raw.parse::<f64>().ok() else { return false };
                    let val = n.as_f64().unwrap_or(f64::NAN);
                    match op {
                        Op::Lt => val < parsed,
                        Op::Lte => val <= parsed,
                        Op::Gt => val > parsed,
                        Op::Gte => val >= parsed,
                        _ => false,
                    }
                }
                Value::Bool(b) => {
                    let target = raw == "true";
                    match op {
                        Op::Lt => *b < target,
                        Op::Lte => *b <= target,
                        Op::Gt => *b > target,
                        Op::Gte => *b >= target,
                        _ => false,
                    }
                }
                Value::String(s) => match op {
                    Op::Lt => s.as_str() < raw,
                    Op::Lte => s.as_str() <= raw,
                    Op::Gt => s.as_str() > raw,
                    Op::Gte => s.as_str() >= raw,
                    _ => false,
                },
                _ => false,
            }
        }
    }
}

fn filter_rows(rows: Vec<Row>, query: &[(String, String)]) -> Vec<Row> {
    let filters: Vec<(String, Op, String)> = query
        .iter()
        .filter(|(k, _)| !RESERVED.contains(&k.as_str()))
        .filter_map(|(k, raw)| parse_filter(raw).map(|(op, rest)| (k.clone(), op, rest.to_string())))
        .collect();
    if filters.is_empty() {
        return rows;
    }
    rows.into_iter()
        .filter(|row| filters.iter().all(|(col, op, raw)| matches_op(row, col, *op, raw)))
        .collect()
}

/// Indices of the rows matching the query filters (mutation-safe).
fn filter_indices(rows: &[Row], query: &[(String, String)]) -> Vec<usize> {
    let filters: Vec<(String, Op, String)> = query
        .iter()
        .filter(|(k, _)| !RESERVED.contains(&k.as_str()))
        .filter_map(|(k, raw)| parse_filter(raw).map(|(op, rest)| (k.clone(), op, rest.to_string())))
        .collect();
    if filters.is_empty() {
        return (0..rows.len()).collect();
    }
    (0..rows.len())
        .filter(|&i| filters.iter().all(|(col, op, raw)| matches_op(&rows[i], col, *op, raw)))
        .collect()
}

fn sort_rows_in_place(rows: &mut Vec<Row>, order: Option<&str>) {
    let Some(order) = order else { return };
    let specs: Vec<(String, i32)> = order
        .split(',')
        .filter_map(|part| {
            let p = part.trim();
            let (col, dir) = match p.split_once('.') {
                Some((c, d)) => (c, d),
                None => (p, ""),
            };
            if col.is_empty() {
                None
            } else {
                Some((col.to_string(), if dir == "desc" { -1 } else { 1 }))
            }
        })
        .collect();
    if specs.is_empty() {
        return;
    }
    rows.sort_by(|a, b| {
        for (col, dir) in &specs {
            let av = a.get(col);
            let bv = b.get(col);
            if av == bv {
                continue;
            }
            let (Some(av), Some(bv)) = (av, bv) else {
                // nulls last
                return if av.is_none() { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Less };
            };
            let cmp = match (av.as_f64(), bv.as_f64()) {
                (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(std::cmp::Ordering::Equal),
                _ => js_string(av).cmp(&js_string(bv)),
            };
            if cmp != std::cmp::Ordering::Equal {
                return if *dir == -1 { cmp.reverse() } else { cmp };
            }
        }
        std::cmp::Ordering::Equal
    });
}

/* ══ The seed-SQL parser (db/seed-content.sql) ═════════════════════════ */

fn split_statements(sql: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    let mut in_str = false;
    let chars: Vec<char> = sql.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if in_str {
            buf.push(c);
            if c == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    buf.push(chars[i + 1]);
                    i += 1;
                } else {
                    in_str = false;
                }
            }
            i += 1;
            continue;
        }
        if c == '\'' {
            in_str = true;
            buf.push(c);
            i += 1;
            continue;
        }
        if c == '-' && i + 1 < chars.len() && chars[i + 1] == '-' {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }
        if c == ';' {
            out.push(buf.clone());
            buf.clear();
            i += 1;
            continue;
        }
        buf.push(c);
        i += 1;
    }
    if !buf.trim().is_empty() {
        out.push(buf);
    }
    out
}

fn parse_value(raw: &str) -> Value {
    let s = raw.trim();
    if s.is_empty() || s == "NULL" {
        return Value::Null;
    }
    if s == "true" {
        return json!(true);
    }
    if s == "false" {
        return json!(false);
    }
    if is_numeric(s) {
        return serde_json::from_str::<f64>(s)
            .ok()
            .and_then(|f| {
                if f.fract() == 0.0 && f.abs() < 9e15 {
                    serde_json::Number::from_i128(f as i128)
                } else {
                    serde_json::Number::from_f64(f)
                }
            })
            .map(Value::Number)
            .unwrap_or(Value::Null);
    }
    if let Some(_) = s.strip_prefix('\'') {
        let mut out = String::new();
        let chars: Vec<char> = s.chars().collect();
        let mut i = 1;
        let mut end = chars.len();
        while i < chars.len() {
            if chars[i] == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    out.push('\'');
                    i += 2;
                    continue;
                }
                end = i;
                break;
            }
            out.push(chars[i]);
            i += 1;
        }
        if end < chars.len() {
            let suffix: String = chars[end + 1..].iter().collect();
            let suffix = suffix.trim();
            if suffix.starts_with("::jsonb") {
                return serde_json::from_str(&out).unwrap_or(Value::String(out));
            }
        }
        return Value::String(out);
    }
    if let Some(inner) = s.strip_prefix("ARRAY[") {
        let inner = &inner[..inner.rfind(']').unwrap_or(inner.len())];
        let mut elems = Vec::new();
        let mut buf = String::new();
        let mut in_str = false;
        let chars: Vec<char> = inner.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            if in_str {
                buf.push(c);
                if c == '\'' {
                    if i + 1 < chars.len() && chars[i + 1] == '\'' {
                        buf.push(chars[i + 1]);
                        i += 1;
                    } else {
                        in_str = false;
                    }
                }
                i += 1;
                continue;
            }
            if c == '\'' {
                in_str = true;
                buf.push(c);
                i += 1;
                continue;
            }
            if c == ',' {
                if !buf.trim().is_empty() {
                    elems.push(parse_value(&buf));
                }
                buf.clear();
                i += 1;
                continue;
            }
            buf.push(c);
            i += 1;
        }
        if !buf.trim().is_empty() {
            elems.push(parse_value(&buf));
        }
        return Value::Array(elems);
    }
    Value::String(s.to_string())
}

fn is_numeric(s: &str) -> bool {
    let body = s.strip_prefix('-').unwrap_or(s);
    !body.is_empty()
        && body.chars().all(|c| c.is_ascii_digit() || c == '.')
        && body.chars().filter(|c| *c == '.').count() <= 1
}

fn split_values(inner: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut buf = String::new();
    let mut depth = 0i32;
    let mut in_str = false;
    let chars: Vec<char> = inner.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if in_str {
            buf.push(c);
            if c == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    buf.push(chars[i + 1]);
                    i += 1;
                } else {
                    in_str = false;
                }
            }
            i += 1;
            continue;
        }
        if c == '\'' {
            in_str = true;
            buf.push(c);
            i += 1;
            continue;
        }
        if c == '(' || c == '[' {
            depth += 1;
        }
        if c == ')' || c == ']' {
            depth -= 1;
        }
        if c == ',' && depth == 0 {
            out.push(buf.clone());
            buf.clear();
            i += 1;
            continue;
        }
        buf.push(c);
        i += 1;
    }
    if !buf.trim().is_empty() {
        out.push(buf);
    }
    out
}

fn parse_insert(stmt: &str) -> Option<(String, Vec<Row>)> {
    let t = stmt.trim();
    // INSERT INTO table (cols) VALUES …
    let rest = t.strip_prefix("INSERT INTO ")?;
    let paren = rest.find('(')?;
    let table = rest[..paren].trim().to_string();
    if !table.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return None;
    }
    let close = rest.find(")")?;
    let cols: Vec<String> = rest[paren + 1..close].split(',').map(|c| c.trim().to_string()).collect();
    let body_raw = rest[close + 1..].trim();
    let body = body_raw
        .strip_prefix("VALUES")
        .or_else(|| body_raw.strip_prefix("values"))?
        .trim();
    let body = body.strip_suffix(';').unwrap_or(body);

    let mut rows = Vec::new();
    let mut tuple = String::new();
    let mut started = false;
    let mut depth = 0i32;
    let mut in_str = false;
    let chars: Vec<char> = body.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if in_str {
            tuple.push(c);
            if c == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    tuple.push(chars[i + 1]);
                    i += 1;
                } else {
                    in_str = false;
                }
            }
            i += 1;
            continue;
        }
        if c == '\'' {
            in_str = true;
            tuple.push(c);
            i += 1;
            continue;
        }
        if c == '(' {
            depth += 1;
            if depth == 1 {
                started = true;
                tuple.clear();
                i += 1;
                continue;
            }
        }
        if c == ')' {
            depth -= 1;
            if depth == 0 {
                let vals = split_values(&tuple);
                let mut row = Row::new();
                for (ci, col) in cols.iter().enumerate() {
                    let v = vals.get(ci).map(|s| s.as_str()).unwrap_or("NULL");
                    row.insert(col.clone(), parse_value(v));
                }
                rows.push(row);
                tuple.clear();
                i += 1;
                continue;
            }
        }
        if started {
            tuple.push(c);
        }
        i += 1;
    }
    Some((table, rows))
}

/// Build the content tables from db/seed-content.sql + messages/*.json.
fn build_content_tables(root: &PathBuf) -> HashMap<String, Vec<Row>> {
    let mut t: HashMap<String, Vec<Row>> = HashMap::new();

    match std::fs::read_to_string(root.join("db/seed-content.sql")) {
        Ok(sql) => {
            for stmt in split_statements(&sql) {
                if let Some((table, rows)) = parse_insert(&stmt) {
                    let target = if table == "psychologists" { "psychologists_v2".to_string() } else { table };
                    t.entry(target).or_default().extend(rows);
                }
            }
        }
        Err(_) => eprintln!("[emu] db/seed-content.sql not found — content tables stay empty"),
    }

    // The v3.3 price sheet (the snapshot predates it).
    if let Some(tiers) = t.get_mut("subscription_tiers") {
        for row in tiers.iter_mut() {
            let code = s(&Value::Object(row.clone()), "code");
            let price = match code.as_str() {
                "plus" => Some(15.0),
                "pro" => Some(40.0),
                "ultra" => Some(60.0),
                _ => None,
            };
            if let Some(p) = price {
                row.insert("price".into(), json!(p));
            }
        }
    }

    // i18n — flattened from messages/*.json.
    let mut i18n_rows = Vec::new();
    {
        let az = read_catalog(root, "az");
        let en = read_catalog(root, "en");
        let ru = read_catalog(root, "ru");
        let mut all_keys: Vec<String> = az
            .keys()
            .chain(en.keys())
            .chain(ru.keys())
            .cloned()
            .collect();
        all_keys.sort();
        all_keys.dedup();
        for key in all_keys {
            let pick = |cat: &std::collections::BTreeMap<String, String>| -> String {
                cat.get(&key).cloned().unwrap_or_default()
            };
            let v_az = pick(&az);
            let v_en = pick(&en);
            let v_ru = pick(&ru);
            let mut row = Row::new();
            row.insert("key".into(), json!(key));
            row.insert("value_az".into(), json!(v_az));
            row.insert("value_en".into(), json!(v_en));
            row.insert("value_ru".into(), json!(v_ru));
            i18n_rows.push(row);
        }
    }
    t.insert("i18n_messages".into(), i18n_rows);

    t
}

fn read_catalog(root: &PathBuf, locale: &str) -> std::collections::BTreeMap<String, String> {
    let mut out = std::collections::BTreeMap::new();
    if let Ok(text) = std::fs::read_to_string(root.join(format!("messages/{locale}.json"))) {
        if let Ok(v) = serde_json::from_str::<Value>(&text) {
            flatten_into(&v, "", &mut out);
        }
    }
    out
}

fn flatten_into(obj: &Value, prefix: &str, out: &mut std::collections::BTreeMap<String, String>) {
    if let Some(map) = obj.as_object() {
        for (k, v) in map {
            let key = if prefix.is_empty() { k.clone() } else { format!("{prefix}.{k}") };
            match v {
                Value::Object(_) => flatten_into(v, &key, out),
                Value::Array(_) => {} // arrays are not flattened (next-intl leaf values only)
                other => {
                    out.insert(key, js_string(other));
                }
            }
        }
    }
}

/// Seed-once base rows: ai_settings, ai_prompts and the demo account.
fn seed_base_rows(data: &mut EmuData, prompt_seeds: &[AiPromptSeed], gemini_key: &str, gemini_model: &str) {
    let now = now_iso();

    if data.tables.get("ai_settings").map(|v| v.is_empty()).unwrap_or(true) {
        let mut row = Row::new();
        row.insert("id".into(), json!(uuid_v4()));
        row.insert("provider".into(), json!("gemini"));
        // Masked: the real key lives in GEMINI_API_KEY (env) — get_ai_settings
        // reads it from config first, this row is only a readable mirror and
        // must never hold the live secret.
        row.insert("api_key".into(), json!(if gemini_key.is_empty() { "" } else { "(env GEMINI_API_KEY)" }));
        row.insert("model".into(), json!(gemini_model));
        row.insert("is_active".into(), json!(true));
        row.insert("created_at".into(), json!(now));
        row.insert("updated_at".into(), json!(now));
        data.tables.insert("ai_settings".into(), vec![row]);
    }

    if data.tables.get("ai_prompts").map(|v| v.is_empty()).unwrap_or(true) {
        let rows = prompt_seeds
            .iter()
            .map(|p| {
                let mut row = Row::new();
                row.insert("id".into(), json!(uuid_v4()));
                row.insert("key".into(), json!(p.key));
                row.insert("content".into(), json!(p.content));
                row.insert("is_active".into(), json!(true));
                row.insert("created_at".into(), json!(now));
                row.insert("updated_at".into(), json!(now));
                row
            })
            .collect();
        data.tables.insert("ai_prompts".into(), rows);
    }

    if data.auth_users.is_empty() {
        let id = uuid_v4();
        let mut user = Row::new();
        user.insert("id".into(), json!(id));
        user.insert("email".into(), json!(DEMO_EMAIL));
        user.insert("pass_hash".into(), json!(hash_password(DEMO_PASSWORD)));
        user.insert("email_confirmed".into(), json!(true));
        user.insert("user_metadata".into(), json!({ "full_name": "Muhəmməd Abdullayev" }));
        user.insert("created_at".into(), json!(now));
        user.insert("updated_at".into(), json!(now));
        user.insert("last_sign_in_at".into(), Value::Null);
        data.auth_users.push(user);

        let mut profile = Row::new();
        profile.insert("id".into(), json!(id));
        profile.insert("full_name".into(), json!("Muhəmməd Abdullayev"));
        for (k, v) in [
            ("username", Value::Null), ("avatar_url", Value::Null), ("lang", json!("az")),
            ("theme", json!("light")), ("rail_folded", json!(false)),
            ("plan_onboarding_done", json!(false)), ("fitness_level", Value::Null),
            ("workouts_per_week", Value::Null), ("reading_goal_books_per_year", Value::Null),
            ("gender", Value::Null), ("birth_year", Value::Null), ("height_cm", Value::Null),
            ("goal", Value::Null), ("activity_level", Value::Null),
        ] {
            profile.insert(k.into(), v);
        }
        profile.insert("created_at".into(), json!(now));
        profile.insert("updated_at".into(), json!(now));
        data.tables.entry("profiles".into()).or_default().push(profile);
    }
}
