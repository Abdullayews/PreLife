//! Environment configuration — reads the repo-root `.env` (PRELIFE_ROOT)
//! and the process environment (Render-style; real env vars win over the
//! file). Mirrors the values the merged Next.js backend read.

use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    /// The repo root: .env, db/, messages/ live here.
    pub root: PathBuf,
    /// SUPABASE_URL (https://…supabase.co) — empty in emulator mode.
    pub supabase_url: String,
    /// SUPABASE_SERVICE_ROLE_KEY.
    pub service_key: String,
    /// SUPABASE_EMU=1 — the in-process Supabase emulator (dev only).
    pub supabase_emu: bool,
    /// Production flag (NODE_ENV=production on Render). Guards the
    /// emulator, dev links and the localhost origin allowlist.
    pub production: bool,
    /// BREVO_API_KEY — the primary production mail transport.
    pub brevo_api_key: String,
    /// MAIL_FROM ("PreLife <a@b.c>").
    pub mail_from: String,
    /// GEMINI_API_KEY / GEMINI_MODEL — env wins over the ai_settings row.
    pub gemini_api_key: String,
    pub gemini_model: String,
    /// PUBLIC_URL (comma-separated origin allowlist) + NEXT_PUBLIC_SITE_URL.
    pub public_url: String,
    pub site_url: String,
    /// The sandbox gateway port (XTransformPort) — appended to
    /// browser-facing backend URLs (OAuth callback, verify links, the
    /// emulator consent form action). Empty in production.
    pub transform_port: String,
    /// The z-ai fallback provider config (baseUrl/apiKey/token…), loaded
    /// from the .z-ai-config JSON the Node SDK would read.
    pub zai: Option<serde_json::Value>,
    /// The listen port (fixed 3030 in this deployment).
    pub port: u16,
}

impl Config {
    /// True when the DB env is present (the non-emu production path).
    pub fn supabase_configured(&self) -> bool {
        !self.supabase_emu && !self.supabase_url.is_empty() && !self.service_key.is_empty()
    }

    /// `supabaseConfigured` as the merged app saw it: the emulator counts
    /// as configured too (every DB-backed endpoint answers).
    pub fn db_ready(&self) -> bool {
        self.supabase_emu || self.supabase_configured()
    }

    /// The GoTrue authorize base for BROWSER navigation. In emulator mode
    /// that is the in-service /api/supa-emu/auth/v1 surface on the public
    /// origin; in production the real {SUPABASE_URL}/auth/v1.
    pub fn browser_auth_base(&self, origin: &str) -> String {
        if self.supabase_emu {
            format!("{origin}/api/supa-emu/auth/v1")
        } else {
            format!("{}/auth/v1", self.supabase_url.trim_end_matches('/'))
        }
    }

    /// The dev-mode flag the merged app derived from NODE_ENV.
    pub fn dev(&self) -> bool {
        !self.production
    }
}

/// Minimal .env parser: KEY=VALUE lines, '#' comments, optional quotes.
fn parse_env_file(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for line in text.lines() {
        let l = line.trim();
        if l.is_empty() || l.starts_with('#') {
            continue;
        }
        let Some(eq) = l.find('=') else { continue };
        let key = l[..eq].trim().to_string();
        let mut val = l[eq + 1..].trim().to_string();
        if val.len() >= 2
            && ((val.starts_with('"') && val.ends_with('"'))
                || (val.starts_with('\'') && val.ends_with('\'')))
        {
            val = val[1..val.len() - 1].to_string();
        }
        if !key.is_empty() {
            out.push((key, val));
        }
    }
    out
}

/// Read a value: process env first, then the .env file map.
fn pick(env_map: &[(String, String)], key: &str) -> String {
    if let Ok(v) = std::env::var(key) {
        if !v.is_empty() {
            return v;
        }
    }
    env_map
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.clone())
        .unwrap_or_default()
}

/// The z-ai provider config — the same JSON the Node SDK loads
/// ($CWD/.z-ai-config → ~/.z-ai-config → /etc/.z-ai-config), read
/// directly so the Rust service can call the HTTP API without Node.
fn load_zai_config(root: &PathBuf) -> Option<serde_json::Value> {
    let mut candidates: Vec<PathBuf> = vec![root.join(".z-ai-config")];
    if let Ok(home) = std::env::var("HOME") {
        candidates.push(PathBuf::from(home).join(".z-ai-config"));
    }
    candidates.push(PathBuf::from("/etc/.z-ai-config"));
    for p in candidates {
        if let Ok(text) = std::fs::read_to_string(&p) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                let base = v.get("baseUrl").and_then(|b| b.as_str()).unwrap_or("");
                let key = v.get("apiKey").and_then(|b| b.as_str()).unwrap_or("");
                if !base.is_empty() && !key.is_empty() {
                    return Some(v);
                }
            }
        }
    }
    None
}

pub fn load() -> Config {
    // The repo root: PRELIFE_ROOT (set by watch.mjs), else ../.. of cwd.
    let root = std::env::var("PRELIFE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            cwd.parent()
                .and_then(|p| p.parent())
                .map(|p| p.to_path_buf())
                .unwrap_or(cwd)
        });

    let env_map = std::fs::read_to_string(root.join(".env"))
        .map(|t| parse_env_file(&t))
        .unwrap_or_default();

    let production = pick(&env_map, "NODE_ENV") == "production"
        || pick(&env_map, "PRELIFE_ENV") == "production";
    let supabase_emu = pick(&env_map, "SUPABASE_EMU") == "1" && !production;
    let zai = load_zai_config(&root);

    Config {
        root,
        supabase_url: pick(&env_map, "SUPABASE_URL"),
        service_key: pick(&env_map, "SUPABASE_SERVICE_ROLE_KEY"),
        supabase_emu,
        production,
        brevo_api_key: pick(&env_map, "BREVO_API_KEY"),
        mail_from: {
            let m = pick(&env_map, "MAIL_FROM");
            if m.is_empty() { "PreLife <no-reply@prelife.net>".into() } else { m }
        },
        gemini_api_key: pick(&env_map, "GEMINI_API_KEY"),
        gemini_model: {
            let m = pick(&env_map, "GEMINI_MODEL");
            if m.is_empty() { "gemini-flash-lite-latest".into() } else { m }
        },
        public_url: pick(&env_map, "PUBLIC_URL"),
        site_url: pick(&env_map, "NEXT_PUBLIC_SITE_URL"),
        transform_port: pick(&env_map, "API_TRANSFORM_PORT"),
        zai,
        port: pick(&env_map, "PRELIFE_API_PORT")
            .parse()
            .unwrap_or(3030),
    }
}
