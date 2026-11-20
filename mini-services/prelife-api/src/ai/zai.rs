//! The z-ai fallback provider — the direct HTTP port of the
//! z-ai-web-dev-sdk chat call (the SDK is a thin fetch wrapper around
//! {baseUrl}/chat/completions with config from .z-ai-config).

use crate::state::St;
use serde_json::{json, Value};

/// POST {baseUrl}/chat/completions with the SDK's exact headers and body.
pub async fn chat(st: &St, system: &str, history: &[(&str, &str)]) -> Result<String, String> {
    let cfg = st.cfg.zai.as_ref().ok_or("z-ai config not found")?;
    let base_url = cfg.get("baseUrl").and_then(|b| b.as_str()).unwrap_or("");
    let api_key = cfg.get("apiKey").and_then(|b| b.as_str()).unwrap_or("");
    if base_url.is_empty() || api_key.is_empty() {
        return Err("z-ai config incomplete".into());
    }

    let mut messages = vec![json!({ "role": "assistant", "content": system })];
    for (role, content) in history {
        messages.push(json!({ "role": role, "content": content }));
    }

    let mut req = st
        .http
        .post(format!("{base_url}/chat/completions"))
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {api_key}"))
        .header("x-z-ai-from", "Z")
        .timeout(std::time::Duration::from_secs(60))
        .body(
            serde_json::to_string(&json!({
                "messages": messages,
                "thinking": { "type": "disabled" },
            }))
            .unwrap_or_default(),
        );
    if let Some(chat_id) = cfg.get("chatId").and_then(|c| c.as_str()) {
        req = req.header("x-chat-id", chat_id);
    }
    if let Some(user_id) = cfg.get("userId").and_then(|c| c.as_str()) {
        req = req.header("x-user-id", user_id);
    }
    if let Some(token) = cfg.get("token").and_then(|c| c.as_str()) {
        req = req.header("x-token", token);
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("z-ai {status}: {text}"));
    }
    let json: Value = serde_json::from_str(&text).map_err(|e| format!("z-ai parse: {e}"))?;
    let reply = json
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let reply: String = crate::util::char_take(&reply, 1500);
    if reply.is_empty() {
        return Err("empty completion".into());
    }
    Ok(reply)
}
