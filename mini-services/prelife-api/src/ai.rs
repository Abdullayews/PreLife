use crate::auth::{current_session, err, parse_body, str_field, App, ApiError};
use crate::config::ZaiConfig;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};

/* ── System prompts (ported verbatim from the Next.js routes) ────────────── */

const SYSTEM_CHAT: &str = "You are PreLife's assistant — a calm, encouraging companion for a life-platform that covers four worlds: fitness (gym plans, partner halls, equipment shopping), nutrition (meal plans, recipes), psychology (psychologists, mood tracking, journaling, meditation) and reading (books, collections). Voice: warm, grounded, concise (3-6 sentences). You help the visitor understand WHAT THEY CAN DO on the platform and guide them to the right section. For fitness you may give safe general training tips; for nutrition, general balanced-eating guidance; for psychology, supportive self-help (breathing, grounding, sleep hygiene) — never diagnose, never give medical or medication advice. When a message suggests crisis or severe distress, respond kindly and briefly point to a professional and local emergency services. Answer in the same language as the user's message.";

const SYSTEM_PSY: &str = "You are PreLife's calm in-app psychology companion. Voice: warm, grounded, non-judgmental; short replies (3-6 sentences). You offer practical self-help: breathing, grounding, sleep hygiene, reflection prompts, habit ideas. You are NOT a licensed clinician: never diagnose, never give medical advice or medication guidance. When a message suggests crisis, self-harm, abuse or severe distress, respond kindly, briefly and point the user to book a professional on the Psychologists page and to local emergency services. Answer in the same language as the user's message.";

const FALLBACK_CHAT: [(&str, [&str; 3]); 3] = [
    ("az", [
        "Sualını dinlədim. PreLife dörd dünyanı birləşdirir: idman, qidalanma, psixologiya və kitab. İstədiyin bölməni seç — orada nələr edə biləcəyini addım-addım göstərərəm.",
        "Yaxşı sualdır. Qısa cavab: idman planı üçün İdman bölməsi, sağlam qidalanma üçün Qidalanma, sakitlik üçün Psixologiya, böyümək üçün Kitablar bölməsi var. Hansından başlamaq istəyirsən?",
        "Bir neçə yol var: bugünkü təlimə başlamaq, yeni resept tapmaq, əhvalını qeyd etmək və ya bir psixoloqla görüş ayırmaq. Özünə yaxın hiss edəni seç — qalanını birlikdə gəzərik.",
    ]),
    ("en", [
        "I hear you. PreLife brings four worlds together: fitness, nutrition, psychology and reading. Pick the one you care about and I'll walk you through what you can do there.",
        "Good question. In short: the Gym section for training plans, Nutrition for meal plans and recipes, Psychology for calm and support, Books for growth. Where would you like to start?",
        "There are a few paths: start today's workout, find a new recipe, log how you feel, or book a psychologist. Choose what feels closest — we'll explore the rest together.",
    ]),
    ("ru", [
        "Я вас услышал. PreLife объединяет четыре мира: фитнес, питание, психологию и чтение. Выберите близкий — и я расскажу, что там можно делать.",
        "Хороший вопрос. Коротко: раздел «Спорт» — планы тренировок, «Питание» — планы и рецепты, «Психология» — спокойствие и поддержка, «Книги» — рост. С чего начнём?",
        "Путей несколько: начать сегодняшнюю тренировку, найти рецепт, отметить настроение или записаться к психологу. Выберите близкое — остальное изучим вместе.",
    ]),
];

const FALLBACK_PSY: [(&str, [&str; 3]); 3] = [
    ("az", [
        "Səni dinlədim. Əvvəlcə bir dəqiqə nəfəsini almağa çalış: 4 saniyə nəfəs al, 7 saxla, 8 saniyə burax. Bu dövrəni dörd dəfə təkrarlasan, gərginlik hissəli şəkildə düşür.",
        "Bəzən ən sakit addım ən balacadır — bugün üçün bir kiçik məqsəd seç: bir stəkan su, qısa gəzinti və ya bir səhifə kitab. Bu kiçik hərəkət zehni yerə qaytarır.",
        "Bu hissəni yazmaq çox dəyərlidir. Jurnal bölməsindəki promptlardan birini aç və fikirlərini boş sahəyə tök — yazmaq emosiyanı nizamlamağa kömək edir.",
    ]),
    ("en", [
        "I hear you. Start with one minute of breathing: inhale 4 seconds, hold 7, exhale 8. Four rounds usually settle the tension noticeably.",
        "Sometimes the calmest step is the smallest — pick one tiny goal for today: a glass of water, a short walk, or one page of a book. Small motion returns the mind to the ground.",
        "Writing this down is valuable. Open one of the journal prompts and pour your thoughts into it — writing helps regulate emotion.",
    ]),
    ("ru", [
        "Я вас слышу. Начните с одной минуты дыхания: вдох 4 секунды, задержка 7, выдох 8. Четыре цикла обычно заметно снижают напряжение.",
        "Иногда самый спокойный шаг — самый маленький: выберите одну маленькую цель на сегодня — стакан воды, короткая прогулка или страница книги. Маленькое движение возвращает мыслям опору.",
        "Записать это — уже ценно. Откройте один из подсказок дневника и вылейте мысли на страницу — письмо помогает упорядочить эмоции.",
    ]),
];

/* ── z-ai chat completion (same HTTP contract as the Node SDK) ───────────── */

struct Msg {
    role: String,
    content: String,
}

async fn zai_chat(cfg: Option<&ZaiConfig>, system: &str, history: &[Msg]) -> Result<String, String> {
    let cfg = cfg.ok_or("z-ai config unavailable")?;
    let mut messages = vec![json!({ "role": "system", "content": system })];
    for m in history {
        messages.push(json!({ "role": m.role, "content": m.content }));
    }

    let client = reqwest::Client::new();
    let mut req = client
        .post(format!("{}/chat/completions", cfg.base_url))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", cfg.api_key))
        .header("X-Z-AI-From", "Z");
    if let Some(v) = &cfg.chat_id {
        req = req.header("X-Chat-Id", v);
    }
    if let Some(v) = &cfg.user_id {
        req = req.header("X-User-Id", v);
    }
    if let Some(v) = &cfg.token {
        req = req.header("X-Token", v);
    }

    let res = req.json(&json!({
        "messages": messages,
        "thinking": { "type": "disabled" },
    })).send().await.map_err(|e| e.to_string())?;

    let status = res.status();
    let body: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("z-ai {status}: {body}"));
    }
    let reply = body.pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .chars().take(1500).collect::<String>();
    if reply.is_empty() {
        return Err("empty completion".into());
    }
    Ok(reply)
}

/* ── Shared request shape ────────────────────────────────────────────────── */

fn parse_history(body: &Value) -> Result<(String, Vec<Msg>), ApiError> {
    let locale = match str_field(body, "locale").as_deref() {
        Some("az") => "az",
        Some("ru") => "ru",
        Some("en") => "en",
        _ => "en",
    };
    let mut history: Vec<Msg> = Vec::new();
    if let Some(arr) = body.get("messages").and_then(|v| v.as_array()) {
        for m in arr {
            let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("");
            let content = m.get("content").and_then(|v| v.as_str()).unwrap_or("");
            if (role == "user" || role == "assistant") && !content.is_empty() {
                history.push(Msg {
                    role: role.to_string(),
                    content: content.chars().take(1200).collect::<String>(),
                });
            }
        }
    }
    let history: Vec<Msg> = history.into_iter().rev().take(8).collect::<Vec<_>>().into_iter().rev().collect();
    if history.is_empty() || history.last().map(|m| m.role.as_str()) != Some("user") {
        return Err(err(StatusCode::BAD_REQUEST, "invalid"));
    }
    Ok((locale.to_string(), history))
}

fn pick_fallback(bank: &[(&str, [&str; 3])], locale: &str) -> String {
    let entry = bank.iter().find(|(l, _)| *l == locale)
        .unwrap_or(&bank[1]); // default en
    let arr = &entry.1;
    let idx = (rand::random::<f64>() * arr.len() as f64) as usize % arr.len();
    arr[idx.min(arr.len() - 1)].to_string()
}

/* ── POST /api/ai/chat (public) ──────────────────────────────────────────── */

pub async fn chat(State(app): State<App>, bytes: Bytes) -> Result<Response, ApiError> {
    let body = parse_body(&bytes);
    let (locale, history) = parse_history(&body)?;
    match zai_chat(app.zai.as_ref(), SYSTEM_CHAT, &history).await {
        Ok(reply) => Ok((StatusCode::OK, Json(json!({ "reply": reply, "source": "ai" }))).into_response()),
        Err(e) => {
            eprintln!("[ai:chat] falling back to canned reply: {e}");
            Ok((StatusCode::OK, Json(json!({ "reply": pick_fallback(&FALLBACK_CHAT, &locale), "source": "canned" }))).into_response())
        }
    }
}

/* ── POST /api/psych/ai (auth) ───────────────────────────────────────────── */

pub async fn psych_chat(State(app): State<App>, headers: HeaderMap, bytes: Bytes) -> Result<Response, ApiError> {
    if current_session(&app.supa, &headers).await.is_none() {
        return Err(err(StatusCode::UNAUTHORIZED, "unauthorized"));
    }
    let body = parse_body(&bytes);
    let (locale, history) = parse_history(&body)?;
    match zai_chat(app.zai.as_ref(), SYSTEM_PSY, &history).await {
        Ok(reply) => Ok((StatusCode::OK, Json(json!({ "reply": reply, "source": "ai" }))).into_response()),
        Err(e) => {
            eprintln!("[psychology:ai] falling back to canned reply: {e}");
            Ok((StatusCode::OK, Json(json!({ "reply": pick_fallback(&FALLBACK_PSY, &locale), "source": "canned" }))).into_response())
        }
    }
}
