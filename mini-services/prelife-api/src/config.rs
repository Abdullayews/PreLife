use serde_json::Value;

/// Runtime configuration: environment (via .env) + the z-ai SDK config
/// file (same lookup order as the Node SDK: cwd, home, /etc).
pub struct ZaiConfig {
    pub base_url: String,
    pub api_key: String,
    pub chat_id: Option<String>,
    pub user_id: Option<String>,
    pub token: Option<String>,
}

pub struct Config {
    pub port: u16,
    pub supabase_url: String,
    pub supabase_key: String,
    pub zai: Option<ZaiConfig>,
}

fn load_env_file(path: &str) {
    if let Ok(text) = std::fs::read_to_string(path) {
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let k = k.trim();
                let v = v.trim().trim_matches('"').trim_matches('\'');
                if std::env::var(k).is_err() {
                    std::env::set_var(k, v);
                }
            }
        }
    }
}

fn load_zai_config() -> Option<ZaiConfig> {
    let cwd = std::env::current_dir().ok()?;
    let mut candidates: Vec<String> = vec![
        cwd.join(".z-ai-config").to_string_lossy().into(),
        cwd.join("../..").join(".z-ai-config").to_string_lossy().into(),
    ];
    if let Some(home) = std::env::var("HOME").ok() {
        candidates.push(format!("{}/.z-ai-config", home));
    }
    candidates.push("/etc/.z-ai-config".into());

    for path in candidates {
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
        let base_url = v.get("baseUrl").and_then(|x| x.as_str()).unwrap_or("").to_string();
        let api_key = v.get("apiKey").and_then(|x| x.as_str()).unwrap_or("").to_string();
        if !base_url.is_empty() && !api_key.is_empty() {
            return Some(ZaiConfig {
                base_url,
                api_key,
                chat_id: v.get("chatId").and_then(|x| x.as_str()).map(String::from),
                user_id: v.get("userId").and_then(|x| x.as_str()).map(String::from),
                token: v.get("token").and_then(|x| x.as_str()).map(String::from),
            });
        }
    }
    None
}

impl Config {
    pub fn load() -> Config {
        // ./.env then ../../.env (repo root) — first value wins.
        load_env_file(".env");
        load_env_file("../../.env");

        Config {
            port: std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3031),
            supabase_url: std::env::var("SUPABASE_URL").unwrap_or_default(),
            supabase_key: std::env::var("SUPABASE_SERVICE_ROLE_KEY").unwrap_or_default(),
            zai: load_zai_config(),
        }
    }
}
