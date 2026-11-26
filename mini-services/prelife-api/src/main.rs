//! prelife-api — the PreLife backend in Rust (axum, port 3030).
//!
//! The complete port of the merged Next.js API: auth (mail-first
//! activation + provider-aware OAuth), psych, content catalogs, gym
//! plans, subscription packages, AI chat (Gemini → z-ai), devices, and
//! the local Supabase emulator for the sandbox.

mod account;
mod ai;
mod config;
mod consent;
mod data_export;
mod content;
mod emu;
mod error;
mod mail;
mod messages;
mod packages;
mod profile;
mod psych;
mod routes;
mod session;
mod state;
mod supa;
mod user_plans;
mod util;
mod verification;

pub use ai::prompts::AiPromptSeed;

use state::AppState;
use std::sync::Arc;

fn main() {
    let cfg = config::load();

    let emu_store = if cfg.supabase_emu {
        let store = Arc::new(emu::EmuStore::boot(
            cfg.root.clone(),
            ai::prompts::AI_PROMPT_SEEDS,
            &cfg.gemini_api_key,
            &cfg.gemini_model,
        ));
        Some(store)
    } else {
        None
    };

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    runtime.block_on(async move {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("reqwest client");

        let supa = if let Some(store) = emu_store.clone() {
            supa::Supa::Emu(store)
        } else {
            supa::Supa::http(&cfg.supabase_url, &cfg.service_key, http.clone())
        };

        if let Some(store) = emu_store.clone() {
            store.start_persist_task();
        }

        let port = cfg.port;
        let production = cfg.production;
        let st = Arc::new(AppState::new(cfg, http, supa, emu_store));

        let app = routes::router(st.clone());

        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
            .await
            .expect("bind");
        println!(
            "[prelife-api] listening on 0.0.0.0:{port} ({} mode, {})",
            if production { "production" } else { "dev" },
            if st.supa.emu_enabled() { "in-process Supabase emulator" } else { "Supabase project" },
        );

        let emu_for_shutdown = st.emu.clone();
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                // SIGINT (ctrl-c) AND SIGTERM (how deploy platforms stop us)
                // both trigger the persist-on-exit path.
                let sigterm = async {
                    #[cfg(unix)]
                    {
                        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                            Ok(mut s) => {
                                s.recv().await;
                            }
                            Err(_) => std::future::pending::<()>().await,
                        }
                    }
                    #[cfg(not(unix))]
                    std::future::pending::<()>().await;
                };
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {}
                    _ = sigterm => {}
                }
                println!("[prelife-api] shutting down — persisting the emu store…");
                if let Some(store) = emu_for_shutdown {
                    store.persist_now();
                }
            })
            .await
            .expect("server");
    });
}
