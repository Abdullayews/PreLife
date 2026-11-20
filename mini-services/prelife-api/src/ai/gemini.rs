//! The Gemini client — generateContent with system instructions, optional
//! function-calling tools and optional JSON mode (reqwest port of
//! ai-gemini.ts).

use serde_json::{json, Map, Value};

pub struct GeminiOut {
    pub text: String,
    pub function_calls: Vec<(String, Value)>,
}

const API_ROOT: &str = "https://generativelanguage.googleapis.com/v1beta/models";

#[allow(clippy::too_many_arguments)]
pub async fn generate(
    api_key: &str,
    model: &str,
    system: Option<&str>,
    contents: &Value,
    tools: Option<&Value>,
    json_mode: bool,
    max_output_tokens: Option<i64>,
    timeout_ms: Option<u64>,
) -> Result<GeminiOut, String> {
    let mut body = Map::new();
    body.insert("contents".into(), contents.clone());
    let mut gen = Map::new();
    gen.insert("maxOutputTokens".into(), json!(max_output_tokens.unwrap_or(2048)));
    gen.insert("temperature".into(), json!(0.7));
    if json_mode {
        gen.insert("responseMimeType".into(), json!("application/json"));
    }
    body.insert("generationConfig".into(), Value::Object(gen));
    if let Some(sys) = system {
        body.insert("systemInstruction".into(), json!({ "parts": [{ "text": sys }] }));
    }
    if let Some(t) = tools {
        body.insert("tools".into(), json!([{ "functionDeclarations": t }]));
    }

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{API_ROOT}/{model}:generateContent"))
        .header("content-type", "application/json")
        .header("x-goog-api-key", api_key)
        .body(serde_json::to_string(&Value::Object(body)).unwrap_or_default())
        .timeout(std::time::Duration::from_millis(timeout_ms.unwrap_or(40_000)))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        let cut: String = text.chars().take(300).collect();
        return Err(format!("gemini {status}: {cut}"));
    }
    let json: Value = serde_json::from_str(&text).map_err(|_| "gemini: unparseable response".to_string())?;

    if let Some(block) = json.pointer("/promptFeedback/blockReason").and_then(|b| b.as_str()) {
        return Err(format!("gemini blocked: {block}"));
    }

    let parts = json
        .pointer("/candidates/0/content/parts")
        .and_then(|p| p.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = String::new();
    let mut function_calls = Vec::new();
    for p in &parts {
        if let Some(t) = p.get("text").and_then(|t| t.as_str()) {
            out.push_str(t);
        }
        if let Some(fc) = p.get("functionCall") {
            if let Some(name) = fc.get("name").and_then(|n| n.as_str()) {
                function_calls.push((name.to_string(), fc.get("args").cloned().unwrap_or(json!({}))));
            }
        }
    }
    Ok(GeminiOut { text: out.trim().to_string(), function_calls })
}

/// Merge consecutive same-role contents and map chat history onto Gemini
/// contents. History items: (role, content).
pub fn contents_from_history(history: &[(&str, &str)]) -> Value {
    let mut out: Vec<Value> = Vec::new();
    for (role, content) in history {
        let role = if *role == "user" { "user" } else { "model" };
        if let Some(last) = out.last_mut() {
            if last.get("role").and_then(|r| r.as_str()) == Some(role) {
                if let Some(parts) = last.get_mut("parts").and_then(|p| p.as_array_mut()) {
                    parts.push(json!({ "text": content }));
                    continue;
                }
            }
        }
        out.push(json!({ "role": role, "parts": [{ "text": content }] }));
    }
    // must start with a user turn
    while let Some(first) = out.first() {
        if first.get("role").and_then(|r| r.as_str()) == Some("user") {
            break;
        }
        out.remove(0);
    }
    json!(out)
}
