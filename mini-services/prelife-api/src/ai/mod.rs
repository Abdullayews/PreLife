//! AI chat — the provider chain (port of lib/server/ai.ts):
//!   1. Gemini (ai_settings / env key) — with ACCOUNT TOOLS for signed-in
//!      users, looping until the model answers with text;
//!   2. z-ai (the .z-ai-config HTTP API) — the plain fallback.
//! NO canned replies: both failing → ApiCode(503, "ai_unavailable").

pub mod gemini;
pub mod prompts;
pub mod zai;

use crate::error::{ApiError, DomainError};
use crate::state::St;
use crate::util::*;
use serde_json::{json, Map, Value};

/* ── Shared request shape ─────────────────────────────────────────────── */

pub struct ParsedChatRequest {
    pub locale: String,
    pub history: Vec<(String, String)>, // (role, content)
}

pub fn parse_chat_body(body: &Value) -> Result<ParsedChatRequest, String> {
    let locale = match body.get("locale").and_then(|l| l.as_str()) {
        Some("az") => "az".to_string(),
        Some("ru") => "ru".to_string(),
        _ => "en".to_string(),
    };

    let mut history: Vec<(String, String)> = Vec::new();
    if let Some(messages) = body.get("messages").and_then(|m| m.as_array()) {
        for m in messages {
            if !m.is_object() {
                continue;
            }
            let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("");
            let content = m.get("content").and_then(|c| c.as_str()).unwrap_or("");
            if (role == "user" || role == "assistant") && !content.is_empty() {
                history.push((role.to_string(), char_take(content, 1200)));
            }
        }
    }
    let trimmed: Vec<(String, String)> = history.into_iter().rev().take(8).collect::<Vec<_>>().into_iter().rev().collect();
    if trimmed.is_empty() || trimmed.last().map(|(r, _)| r != "user").unwrap_or(true) {
        return Err("invalid".into());
    }
    Ok(ParsedChatRequest { locale, history: trimmed })
}

/* ── Settings + prompts (ai_settings / ai_prompts, TTL-cached) ────────── */

pub struct AiSettings {
    pub api_key: String,
    pub model: String,
}

pub async fn get_ai_settings(st: &St) -> Option<AiSettings> {
    let env_key = st.cfg.gemini_api_key.trim().to_string();
    if !env_key.is_empty() {
        return Some(AiSettings { api_key: env_key, model: st.cfg.gemini_model.clone() });
    }
    if let Some(hit) = st.ttl_get("ai:settings") {
        if let Some(active) = hit.get("active").and_then(|a| a.as_bool()) {
            if !active {
                return None;
            }
            return Some(AiSettings {
                api_key: hit.get("apiKey").and_then(|k| k.as_str()).unwrap_or("").to_string(),
                model: hit.get("model").and_then(|m| m.as_str()).unwrap_or("").to_string(),
            });
        }
        return None;
    }
    let row = st
        .supa
        .select_one("ai_settings", &[("select", "api_key,model,is_active"), ("provider", "eq.gemini")])
        .await
        .ok()
        .flatten();
    let out = match row {
        Some(row) => {
            let rv = Value::Object(row);
            let api_key = s(&rv, "api_key");
            let model = {
                let m = s(&rv, "model");
                if m.is_empty() { st.cfg.gemini_model.clone() } else { m }
            };
            let active = rv.get("is_active") != Some(&json!(false)) && !api_key.is_empty();
            json!({ "apiKey": api_key, "model": model, "active": active })
        }
        None => json!({ "apiKey": "", "model": st.cfg.gemini_model, "active": false }),
    };
    let active = out.get("active").and_then(|a| a.as_bool()).unwrap_or(false);
    st.ttl_put("ai:settings", out.clone());
    if active {
        Some(AiSettings {
            api_key: out.get("apiKey").and_then(|k| k.as_str()).unwrap_or("").to_string(),
            model: out.get("model").and_then(|m| m.as_str()).unwrap_or("").to_string(),
        })
    } else {
        None
    }
}

fn fallback_prompt(key: &str) -> &'static str {
    match key {
        "assistant" => prompts::PROMPT_ASSISTANT,
        "psych" => prompts::PROMPT_PSYCH,
        "plan" => prompts::PROMPT_PLAN,
        "context" => prompts::PROMPT_CONTEXT,
        _ => "",
    }
}

pub async fn get_ai_prompt(st: &St, key: &str) -> String {
    let cache_key = format!("ai:prompt:{key}");
    if let Some(hit) = st.ttl_get(&cache_key) {
        if let Some(s) = hit.as_str() {
            return s.to_string();
        }
    }
    let row = st
        .supa
        .select_one("ai_prompts", &[("select", "content"), ("key", &format!("eq.{key}"))])
        .await
        .ok()
        .flatten();
    let content = match row {
        Some(row) => {
            let rv = Value::Object(row);
            match s_opt(&rv, "content") {
                Some(c) if !c.trim().is_empty() => c,
                _ => fallback_prompt(key).to_string(),
            }
        }
        None => fallback_prompt(key).to_string(),
    };
    if !content.is_empty() {
        st.ttl_put(&cache_key, json!(content));
    }
    content
}

/* ── Provider chain ───────────────────────────────────────────────────── */

/// Gemini when configured, z-ai otherwise — plain chat, no tools.
pub async fn chat_via_provider(st: &St, system: &str, history: &[(String, String)]) -> Result<(String, &'static str), DomainError> {
    if let Some(settings) = get_ai_settings(st).await {
        let contents = history.iter().map(|(r, c)| (r.as_str(), c.as_str())).collect::<Vec<_>>();
        let gem = gemini::generate(&settings.api_key, &settings.model, Some(system), &gemini::contents_from_history(&contents), None, false, None, None).await;
        match gem {
            Ok(out) if !out.text.is_empty() => {
                return Ok((char_take(&out.text, 1500), "gemini"));
            }
            Err(e) => eprintln!("[ai] gemini failed → z-ai fallback: {e}"),
            Ok(_) => eprintln!("[ai] gemini failed → z-ai fallback: empty reply"),
        }
    }
    let contents = history.iter().map(|(r, c)| (r.as_str(), c.as_str())).collect::<Vec<_>>();
    match zai::chat(st, system, &contents).await {
        Ok(reply) => Ok((reply, "zai")),
        Err(e) => Err(DomainError::msg(format!("z-ai failed: {e}"))),
    }
}

/// The psychology companion: provider chain with an HONEST failure.
pub async fn psych_reply(st: &St, history: &[(String, String)]) -> Result<(String, &'static str), DomainError> {
    let system = get_ai_prompt(st, "psych").await;
    match chat_via_provider(st, &system, history).await {
        Ok(out) => Ok(out),
        Err(e) => {
            eprintln!("[ai] psych: both providers failed → honest 503: {e}");
            Err(DomainError::Api(ApiError::new(axum::http::StatusCode::SERVICE_UNAVAILABLE, "ai_unavailable")))
        }
    }
}

/* ── Account tools (function calling, signed-in users only) ───────────── */

fn tool_decls() -> Value {
    json!([
        {
            "name": "get_my_data",
            "description": "Read the signed-in user's PreLife data: profile (name, weight, height, goal, activity), the active workout plan and their custom package requests. Use it before updating, or when the user asks what you know about them.",
            "parameters": { "type": "object", "properties": {} },
        },
        {
            "name": "update_my_profile",
            "description": "Update the user's own profile data and account preferences: body metrics, goal, activity, app theme, interface language, content location (global or Azerbaijan-only). Only include the fields to change. Weight changes are logged to history automatically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "Display name (1-100 chars)" },
                    "weightKg": { "type": "number", "description": "Weight in kilograms (20-400)" },
                    "heightCm": { "type": "number", "description": "Height in centimeters (80-260)" },
                    "birthYear": { "type": "integer", "description": "Birth year (1900-now)" },
                    "gender": { "type": "string", "enum": ["male", "female", "other"] },
                    "goal": { "type": "string", "enum": ["lose", "maintain", "gain", "fitness"] },
                    "activityLevel": { "type": "string", "enum": ["sedentary", "light", "moderate", "active", "athlete"] },
                    "fitnessLevel": { "type": "string", "enum": ["beginner", "intermediate", "advanced"] },
                    "workoutsPerWeek": { "type": "integer", "description": "Planned workouts per week (0-14)" },
                    "theme": { "type": "string", "enum": ["light", "dark"], "description": "App color theme" },
                    "lang": { "type": "string", "enum": ["az", "en", "ru"], "description": "Interface language" },
                    "contentLocation": { "type": "string", "enum": ["global", "az"], "description": "Content scope: global, or Azerbaijan-only" },
                },
            },
        },
        {
            "name": "create_my_workout_plan",
            "description": "Create and activate a personal weekly workout plan for the user, replacing the previous one. Prefer registry exercise codes from the context; write names/reps/notes in the user's language.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": { "type": "string" },
                    "level": { "type": "string", "enum": ["Başlanğıc", "Orta", "İleri"] },
                    "totalWeeks": { "type": "integer", "description": "Plan length in weeks (4-16)" },
                    "focus": { "type": "string", "description": "One-line plan focus" },
                    "days": {
                        "type": "array",
                        "description": "1-7 training days",
                        "items": {
                            "type": "object",
                            "properties": {
                                "day": { "type": "integer", "description": "ISO weekday: 1=Monday … 7=Sunday" },
                                "focus": { "type": "string" },
                                "exercises": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "ex": { "type": "string", "description": "Registry code, or empty string when not in the registry" },
                                            "name": { "type": "string" },
                                            "sets": { "type": "integer" },
                                            "reps": { "type": "string", "description": "e.g. \"8-10\" or \"40 saniyə\"" },
                                            "rest": { "type": "integer", "description": "Rest seconds (0-300)" },
                                            "note": { "type": "string", "description": "Optional short coaching cue" },
                                        },
                                        "required": ["name", "sets", "reps"],
                                    },
                                },
                            },
                            "required": ["day", "focus", "exercises"],
                        },
                    },
                },
                "required": ["title", "days"],
            },
        },
        {
            "name": "create_custom_package",
            "description": "Create a custom subscription package request for the user. The price is computed server-side from the picked features and duration (1/3/6/12 months with 0/5/10/15% off).",
            "parameters": {
                "type": "object",
                "properties": {
                    "features": {
                        "type": "array",
                        "items": { "type": "string", "enum": ["gym", "diet", "psych", "library", "ai", "videos", "coaching", "family"] },
                    },
                    "months": { "type": "integer", "description": "Package duration in months. Must be one of: 1, 3, 6 or 12." },
                },
                "required": ["features", "months"],
            },
        },
    ])
}

async fn run_tool(st: &St, name: &str, args: &Value, user: &Value, locale: &str) -> Value {
    let user_id = s(user, "id");
    let result: Result<Value, DomainError> = async {
        match name {
            "get_my_data" => {
                let profile = crate::profile::get_profile_view(st, &user_id).await?;
                let plan = crate::user_plans::get_active_plan(st, &user_id).await;
                let packages = crate::packages::list_custom_packages(st, &user_id).await;
                let mut pkgs = packages;
                pkgs.truncate(5);
                Ok(json!({
                    "ok": true,
                    "email": s(user, "email"),
                    "profile": profile,
                    "activePlan": plan,
                    "customPackages": pkgs,
                }))
            }
            "update_my_profile" => {
                let mut patch = Map::new();
                for key in [
                    "name", "weightKg", "heightCm", "birthYear", "gender", "goal",
                    "activityLevel", "fitnessLevel", "workoutsPerWeek", "theme", "lang", "contentLocation",
                ] {
                    if let Some(v) = args.get(key) {
                        patch.insert(key.to_string(), v.clone());
                    }
                }
                let profile = crate::profile::update_profile(st, &user_id, &Value::Object(patch)).await?;
                Ok(json!({ "ok": true, "profile": profile }))
            }
            "create_my_workout_plan" => {
                let plan = crate::user_plans::save_chat_plan(st, &user_id, args, locale).await;
                match plan {
                    Some(p) => Ok(json!({ "ok": true, "plan": p })),
                    None => Ok(json!({ "ok": false, "error": "invalid_plan" })),
                }
            }
            "create_custom_package" => {
                let pkg = crate::packages::create_custom_package(
                    st,
                    &user_id,
                    args.get("features").unwrap_or(&Value::Null),
                    args.get("months").unwrap_or(&Value::Null),
                )
                .await?;
                Ok(json!({ "ok": true, "package": pkg }))
            }
            _ => Ok(json!({ "ok": false, "error": "unknown_tool" })),
        }
    }
    .await;
    match result {
        Ok(v) => v,
        Err(e) => {
            let code = match e {
                DomainError::Api(a) => a.code,
                DomainError::Msg(_) => "tool_failed".to_string(),
            };
            json!({ "ok": false, "error": code })
        }
    }
}

/* ── Context (the signed-in user's situation) ─────────────────────────── */

fn page_label(page: Option<&str>) -> String {
    let Some(page) = page else { return "unknown".to_string() };
    let stripped = match page.strip_prefix("/az").or_else(|| page.strip_prefix("/en")).or_else(|| page.strip_prefix("/ru")) {
        Some(rest) if rest.is_empty() || rest.starts_with('/') => rest.to_string(),
        _ => page.to_string(),
    };
    let stripped = if stripped.is_empty() { "/".to_string() } else { stripped };
    let trimmed = stripped.trim_end_matches('/');
    let base = if trimmed.is_empty() { "/" } else { trimmed };
    let labels: &[(&str, &str)] = &[
        ("/home", "Home dashboard"),
        ("/gym", "Gym / İdman (plan, shops, halls, equipment)"),
        ("/diet", "Nutrition (diet)"),
        ("/diet/plans", "Nutrition → meal plans"),
        ("/diet/recipes", "Nutrition → recipes"),
        ("/diet/places", "Nutrition → venues"),
        ("/meditation", "Psychology (meditation)"),
        ("/meditation/mood", "Psychology → mood tracking"),
        ("/meditation/journal", "Psychology → journal"),
        ("/meditation/psychologists", "Psychology → psychologists"),
        ("/meditation/bookings", "Psychology → my bookings"),
        ("/meditation/practice", "Psychology → practice media"),
        ("/meditation/tdb", "Psychology → TDB videos"),
        ("/library", "Library (reading)"),
        ("/subscription", "Subscription / packages"),
        ("/profile", "Profile"),
        ("/settings", "Settings"),
        ("/help", "Help"),
    ];
    for (path, label) in labels {
        if base == *path {
            return format!("{label} ({page})");
        }
    }
    page.to_string()
}

async fn build_context_block(st: &St, user: &Value, page: Option<&str>) -> String {
    let template = get_ai_prompt(st, "context").await;
    let user_id = s(user, "id");
    let profile = crate::profile::profile_summary_line(st, &user_id).await;
    let plan = crate::user_plans::plan_summary_line(st, &user_id).await;
    let pkg = crate::packages::package_summary_line(st, &user_id).await;
    let name = s_opt(user, "name")
        .unwrap_or_else(|| s(user, "email").split('@').next().unwrap_or("").to_string());
    template
        .replace("{name}", &name)
        .replace("{email}", &s(user, "email"))
        .replace("{profile}", &profile)
        .replace("{page}", &page_label(page))
        .replace("{plan}", &plan)
        .replace("{package}", &pkg)
}

/* ── The main assistant (provider chain + tools, honest failure) ──────── */

pub async fn assistant_reply(
    st: &St,
    locale: &str,
    history: &[(String, String)],
    page: Option<&str>,
    user: Option<&Value>,
) -> Result<(String, &'static str), DomainError> {
    let system = get_ai_prompt(st, "assistant").await;
    let context = match user {
        Some(u) => format!("\n\n{}", build_context_block(st, u, page).await),
        None => String::new(),
    };
    let full_system = format!("{system}{context}");

    // v5.2 (loop iter 3): a wall-clock budget across the tool loop AND the
    // z-ai fallback — a slow upstream could previously hold one request
    // for ~260s (5×40s Gemini rounds + the 60s fallback) with no cap.
    let started = std::time::Instant::now();
    const BUDGET: std::time::Duration = std::time::Duration::from_secs(90);

    if let Some(settings) = get_ai_settings(st).await {
        let contents_slice: Vec<(&str, &str)> = history.iter().map(|(r, c)| (r.as_str(), c.as_str())).collect();
        let mut contents = gemini::contents_from_history(&contents_slice);
        let tools = user.map(|_| tool_decls());
        let mut last_err = String::new();
        for _round in 0..5 {
            if started.elapsed() >= BUDGET {
                last_err = "assistant wall-clock budget exceeded".into();
                break;
            }
            let result = gemini::generate(
                &settings.api_key,
                &settings.model,
                Some(&full_system),
                &contents,
                tools.as_ref(),
                false,
                None,
                None,
            )
            .await;
            match result {
                Ok(out) => {
                    if !out.function_calls.is_empty() && user.is_some() {
                        // Push the model's function calls.
                        let parts: Vec<Value> = out
                            .function_calls
                            .iter()
                            .map(|(name, args)| json!({ "functionCall": { "name": name, "args": args } }))
                            .collect();
                        if let Some(arr) = contents.as_array_mut() {
                            arr.push(json!({ "role": "model", "parts": parts }));
                        }
                        let user_id = s(user.unwrap(), "id");
                        let _ = user_id;
                        let mut responses: Vec<Value> = Vec::new();
                        for (name, args) in &out.function_calls {
                            responses.push(json!({
                                "functionResponse": {
                                    "name": name,
                                    "response": run_tool(st, name, args, user.unwrap(), locale).await,
                                }
                            }));
                        }
                        if let Some(arr) = contents.as_array_mut() {
                            arr.push(json!({ "role": "user", "parts": responses }));
                        }
                        continue;
                    }
                    if !out.text.is_empty() {
                        return Ok((char_take(&out.text, 1500), "gemini"));
                    }
                    last_err = "empty gemini reply".into();
                }
                Err(e) => last_err = e,
            }
            break;
        }
        if last_err.is_empty() {
            last_err = "tool loop budget exceeded".into();
        }
        eprintln!("[ai] gemini failed → z-ai fallback: {last_err}");
    }

    let contents_slice: Vec<(&str, &str)> = history.iter().map(|(r, c)| (r.as_str(), c.as_str())).collect();
    // v5.2 (loop iter 3): skip the fallback when the budget can no longer
    // fit its own timeout — fail honestly instead of holding the request.
    if started.elapsed() + std::time::Duration::from_secs(30) > BUDGET {
        eprintln!("[ai] wall-clock budget exhausted before the z-ai fallback — honest 503");
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::SERVICE_UNAVAILABLE, "ai_unavailable")));
    }
    match zai::chat(st, &full_system, &contents_slice).await {
        Ok(reply) => Ok((reply, "zai")),
        Err(e) => {
            eprintln!("[ai] z-ai failed → honest 503 (no canned replies): {e}");
            Err(DomainError::Api(ApiError::new(axum::http::StatusCode::SERVICE_UNAVAILABLE, "ai_unavailable")))
        }
    }
}
