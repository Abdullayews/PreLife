//! Personal workout plans — port of lib/server/user-plans.ts. One ACTIVE
//! plan per user in user_plans; the default starter plan is created
//! lazily; the questionnaire (or an AI chat tool call) replaces it.

use crate::error::DomainError;
use crate::state::St;
use crate::util::*;
use serde_json::{json, Map, Value};

type Res<T> = Result<T, DomainError>;

fn v(row: &Row) -> Value {
    Value::Object(row.clone())
}

/* ── The exercise registry ────────────────────────────────────────────── */

const FALLBACK_CODES: &[&str] = &[
    "run", "stretch", "squat", "deadlift", "bench", "pullup", "row", "ohp",
    "lunge", "plank", "swing", "legpress", "latpull", "bicep", "triceps",
];

/// code → (name, target) — the live registry from gym_exercises through
/// the content layer, resolved to the locale at call time.
pub async fn load_exercise_registry(st: &St, locale: &str) -> Vec<(String, String, String)> {
    if let Some(cat) = crate::content::gym_catalog(st).await {
        if let Some(ex) = cat.get("exercises").and_then(|e| e.as_object()) {
            if !ex.is_empty() {
                let mut reg = Vec::new();
                for (code, refv) in ex {
                    let name_key = s(refv, "nameKey");
                    let target_key = s(refv, "targetKey");
                    let name = crate::messages::lookup(st, locale, &format!("gymApp.{name_key}"))
                        .await
                        .unwrap_or_else(|| code.clone());
                    let target = crate::messages::lookup(st, locale, &format!("gymApp.{target_key}"))
                        .await
                        .unwrap_or_default();
                    reg.push((code.clone(), name, target));
                }
                return reg;
            }
        }
    }
    FALLBACK_CODES.iter().map(|c| (c.to_string(), c.to_string(), String::new())).collect()
}

fn registry_get<'a>(reg: &'a [(String, String, String)], code: &str) -> Option<&'a (String, String, String)> {
    reg.iter().find(|(c, _, _)| c == code)
}

pub fn registry_block(reg: &[(String, String, String)]) -> String {
    reg.iter().map(|(c, n, t)| format!("{c} — {n} ({t})")).collect::<Vec<_>>().join("; ")
}

/* ── Reading ──────────────────────────────────────────────────────────── */

pub fn row_to_plan(row: &Row) -> Option<Value> {
    let rv = v(row);
    let id = s_opt(&rv, "id")?;
    let days = rv.get("days").and_then(|d| d.as_array().cloned()).unwrap_or_default();
    let title = {
        let t = s(&rv, "title");
        if t.is_empty() { "Plan".to_string() } else { t }
    };
    Some(json!({
        "id": id,
        "title": title,
        "level": s_opt(&rv, "level").map(Value::String).unwrap_or(Value::Null),
        "source": if s(&rv, "source") == "ai" { "ai" } else { "default" },
        "week": i64_opt(&rv, "week").unwrap_or(1),
        "total": i64_opt(&rv, "total").unwrap_or(8),
        "focus": s_opt(&rv, "focus").map(Value::String).unwrap_or(Value::Null),
        "days": days,
        "notes": s_opt(&rv, "notes").map(Value::String).unwrap_or(Value::Null),
        "createdAt": s(&rv, "created_at"),
        "updatedAt": s(&rv, "updated_at"),
    }))
}

pub async fn get_active_plan(st: &St, user_id: &str) -> Option<Value> {
    let row = st
        .supa
        .select_one(
            "user_plans",
            &vec![
                ("select".into(), "*".into()),
                ("user_id".into(), format!("eq.{user_id}")),
                ("active".into(), "eq.true".into()),
                ("order".into(), "created_at.desc".into()),
            ],
        )
        .await
        .ok()??;
    row_to_plan(&row)
}

/// One-line plan summary for the AI context prompt.
pub async fn plan_summary_line(st: &St, user_id: &str) -> String {
    match get_active_plan(st, user_id).await {
        None => "none yet (the user still has the default starter plan or none)".to_string(),
        Some(p) => format!(
            "\"{}\" ({}), week {}/{}, {} training days/week",
            p.get("title").and_then(|t| t.as_str()).unwrap_or("Plan"),
            if p.get("source") == Some(&json!("ai")) { "AI-generated" } else { "starter" },
            p.get("week").map(|w| w.to_string()).unwrap_or_default(),
            p.get("total").map(|t| t.to_string()).unwrap_or_default(),
            p.get("days").and_then(|d| d.as_array()).map(|a| a.len()).unwrap_or(0),
        ),
    }
}

/* ── The default starter plan ─────────────────────────────────────────── */

struct Copy {
    title: &'static str,
    focus: &'static str,
    levels: [&'static str; 3],
    day_a: &'static str,
    day_b: &'static str,
    day_c: &'static str,
}

fn default_copy(locale: &str) -> Copy {
    match locale {
        "en" => Copy {
            title: "Starter plan", focus: "Full-body strength & habit",
            levels: ["Beginner", "Intermediate", "Advanced"],
            day_a: "Full body A", day_b: "Full body B", day_c: "Full body C",
        },
        "ru" => Copy {
            title: "Стартовый план", focus: "Сила всего тела и привычка",
            levels: ["Начальный", "Средний", "Продвинутый"],
            day_a: "Всё тело A", day_b: "Всё тело B", day_c: "Всё тело C",
        },
        _ => Copy {
            title: "Başlanğıc plan", focus: "Bütün bədən gücü və vərdiş",
            levels: ["Başlanğıc", "Orta", "İleri"],
            day_a: "Bütün bədən A", day_b: "Bütün bədən B", day_c: "Bütün bədən C",
        },
    }
}

fn ex(reg: &[(String, String, String)], code: &str, sets: i64, reps: &str, rest: i64, note: Option<&str>) -> Value {
    let r = registry_get(reg, code);
    let mut obj = Map::new();
    obj.insert("ex".into(), json!(code));
    obj.insert("name".into(), json!(r.map(|(_, n, _)| n.clone()).unwrap_or_else(|| code.to_string())));
    obj.insert("sets".into(), json!(sets));
    obj.insert("reps".into(), json!(reps));
    obj.insert("rest".into(), json!(rest));
    if let Some(n) = note {
        obj.insert("note".into(), json!(n));
    }
    Value::Object(obj)
}

fn default_plan(locale: &str, reg: &[(String, String, String)]) -> Value {
    let c = default_copy(locale);
    json!({
        "title": c.title,
        "level": c.levels[0],
        "source": "default",
        "week": 1,
        "total": 8,
        "focus": c.focus,
        "days": [
            {
                "day": 1,
                "focus": c.day_a,
                "exercises": [
                    ex(reg, "run", 1, "5–8 dəq", 0, None),
                    ex(reg, "squat", 4, "8–10", 90, None),
                    ex(reg, "bench", 4, "8–10", 90, None),
                    ex(reg, "row", 4, "10–12", 75, None),
                    ex(reg, "plank", 3, "30–45 s", 60, None),
                ],
            },
            {
                "day": 3,
                "focus": c.day_b,
                "exercises": [
                    ex(reg, "run", 1, "5–8 dəq", 0, None),
                    ex(reg, "deadlift", 4, "6–8", 120, None),
                    ex(reg, "ohp", 4, "8–10", 90, None),
                    ex(reg, "latpull", 4, "10–12", 75, None),
                    ex(reg, "bicep", 3, "10–12", 60, None),
                ],
            },
            {
                "day": 5,
                "focus": c.day_c,
                "exercises": [
                    ex(reg, "run", 1, "5–8 dəq", 0, None),
                    ex(reg, "legpress", 4, "10–12", 90, None),
                    ex(reg, "lunge", 3, "10 (hər ayaq)", 75, None),
                    ex(reg, "triceps", 3, "10–12", 60, None),
                    ex(reg, "stretch", 1, "5 dəq", 0, None),
                ],
            },
        ],
        "notes": Value::Null,
    })
}

/* ── Validation / normalization ───────────────────────────────────────── */

fn clamp(v: f64, lo: f64, hi: f64, dflt: i64) -> i64 {
    if v.is_finite() {
        (v.min(hi).max(lo)).round() as i64
    } else {
        dflt
    }
}

fn str_field(v: &Value, key: &str, max: usize, dflt: &str) -> String {
    match v.get(key) {
        Some(Value::String(s)) if !s.trim().is_empty() => char_take(s.trim(), max),
        _ => dflt.to_string(),
    }
}

pub fn normalize_plan_input(raw: &Value, locale: &str, reg: &[(String, String, String)]) -> Option<Value> {
    if !raw.is_object() {
        return None;
    }
    let days_raw = raw.get("days").and_then(|d| d.as_array())?.clone();
    if days_raw.is_empty() {
        return None;
    }

    let name_fallback = match locale {
        "en" => "Exercise",
        "ru" => "Упражнение",
        _ => "Hərəkət",
    };
    let focus_fallback = match locale {
        "en" => "Training",
        "ru" => "Тренировка",
        _ => "Təlim",
    };

    let mut seen_days: Vec<i64> = Vec::new();
    let mut days: Vec<Value> = Vec::new();
    for d_raw in days_raw.iter().take(7) {
        if !d_raw.is_object() {
            continue;
        }
        let day_num = d_raw.get("day").and_then(|d| d.as_f64()).unwrap_or(f64::NAN);
        let day = clamp(day_num, 1.0, 7.0, 1);
        if seen_days.contains(&day) {
            continue;
        }
        seen_days.push(day);
        let ex_raw = d_raw.get("exercises").and_then(|e| e.as_array()).cloned().unwrap_or_default();
        let mut exercises: Vec<Value> = Vec::new();
        for e_raw in ex_raw.iter().take(10) {
            if !e_raw.is_object() {
                continue;
            }
            let code = match e_raw.get("ex") {
                Some(Value::String(s)) if registry_get(reg, s).is_some() => s.clone(),
                _ => String::new(),
            };
            let reg_name = registry_get(reg, &code).map(|(_, n, _)| n.clone());
            let mut name = str_field(e_raw, "name", 60, "");
            if name.is_empty() {
                name = reg_name.unwrap_or_else(|| name_fallback.to_string());
            }
            let note = str_field(e_raw, "note", 160, "");
            let mut obj = Map::new();
            obj.insert("ex".into(), json!(code));
            obj.insert("name".into(), json!(name));
            obj.insert("sets".into(), json!(clamp(e_raw.get("sets").and_then(|s| s.as_f64()).unwrap_or(f64::NAN), 1.0, 8.0, 3)));
            obj.insert("reps".into(), json!(str_field(e_raw, "reps", 24, "10")));
            obj.insert("rest".into(), json!(clamp(e_raw.get("rest").and_then(|s| s.as_f64()).unwrap_or(f64::NAN), 0.0, 300.0, 90)));
            if !note.is_empty() {
                obj.insert("note".into(), json!(note));
            }
            exercises.push(Value::Object(obj));
        }
        if exercises.is_empty() {
            continue;
        }
        days.push(json!({
            "day": day,
            "focus": str_field(d_raw, "focus", 60, focus_fallback),
            "exercises": exercises,
        }));
    }
    if days.is_empty() {
        return None;
    }
    days.sort_by_key(|d| d.get("day").and_then(|d| d.as_i64()).unwrap_or(1));

    let total = raw
        .get("totalWeeks")
        .or_else(|| raw.get("total"))
        .and_then(|t| t.as_f64())
        .unwrap_or(f64::NAN);

    let base = default_plan(locale, reg);
    let title_raw = str_field(raw, "title", 80, "");
    let title = if title_raw.is_empty() {
        base.get("title").cloned().unwrap_or(json!("Plan"))
    } else {
        json!(title_raw)
    };
    let level_raw = str_field(raw, "level", 20, "");
    let focus_raw = str_field(raw, "focus", 120, "");
    let notes_raw = str_field(raw, "notes", 400, "");

    let mut plan = Map::new();
    plan.insert("title".into(), title);
    plan.insert("level".into(), if level_raw.is_empty() { Value::Null } else { json!(level_raw) });
    plan.insert("source".into(), json!(if raw.get("source") == Some(&json!("default")) { "default" } else { "ai" }));
    plan.insert("week".into(), json!(1));
    plan.insert("total".into(), json!(clamp(total, 4.0, 16.0, 8)));
    plan.insert("focus".into(), if focus_raw.is_empty() { Value::Null } else { json!(focus_raw) });
    plan.insert("days".into(), json!(days));
    plan.insert("notes".into(), if notes_raw.is_empty() { Value::Null } else { json!(notes_raw) });
    Some(Value::Object(plan))
}

/* ── Writing ──────────────────────────────────────────────────────────── */

async fn insert_active(st: &St, user_id: &str, plan: &Value) -> Option<Value> {
    let _ = st
        .supa
        .update(
            "user_plans",
            &vec![("user_id".into(), format!("eq.{user_id}")), ("active".into(), "eq.true".into())],
            &json!({ "active": false }),
        )
        .await;
    let row = st
        .supa
        .insert(
            "user_plans",
            &json!({
                "user_id": user_id,
                "title": plan.get("title").cloned().unwrap_or(json!("Plan")),
                "level": plan.get("level").cloned().unwrap_or(Value::Null),
                "source": plan.get("source").cloned().unwrap_or(json!("default")),
                "week": plan.get("week").cloned().unwrap_or(json!(1)),
                "total": plan.get("total").cloned().unwrap_or(json!(8)),
                "focus": plan.get("focus").cloned().unwrap_or(Value::Null),
                "days": plan.get("days").cloned().unwrap_or(json!([])),
                "notes": plan.get("notes").cloned().unwrap_or(Value::Null),
                "active": true,
            }),
        )
        .await
        .ok()??;
    row_to_plan(&row)
}

/// The user's plan — the default starter plan is created lazily.
pub async fn ensure_default_plan(st: &St, user_id: &str, locale: &str) -> Option<Value> {
    if let Some(existing) = get_active_plan(st, user_id).await {
        return Some(existing);
    }
    let reg = load_exercise_registry(st, locale).await;
    let mut plan = default_plan(locale, &reg);
    plan.as_object_mut().unwrap().insert("source".into(), json!("default"));
    match insert_active(st, user_id, &plan).await {
        Some(p) => Some(p),
        None => {
            eprintln!("[plans] default plan insert failed");
            None
        }
    }
}

/// Deactivate everything (the next read re-creates the starter plan).
pub async fn reset_plans(st: &St, user_id: &str) {
    let _ = st
        .supa
        .update("user_plans", &vec![("user_id".into(), format!("eq.{user_id}"))], &json!({ "active": false }))
        .await;
}

/* ── AI generation ────────────────────────────────────────────────────── */

pub async fn generate_plan(st: &St, user_id: &str, answers: &Value, locale: &str) -> Res<(Option<Value>, &'static str)> {
    let lang_name = match locale {
        "en" => "English",
        "ru" => "Russian",
        _ => "Azerbaijani",
    };
    let settings = crate::ai::get_ai_settings(st).await;
    let reg = load_exercise_registry(st, locale).await;

    if let Some(settings) = settings {
        let system = crate::ai::get_ai_prompt(st, "plan").await;
        let user = format!(
            "Questionnaire answers (JSON): {}\nAnswer language: {lang_name} — every user-facing string must be in {lang_name}.\nEXERCISE REGISTRY (code — name — target): {}.",
            serde_json::to_string(answers).unwrap_or_default(),
            registry_block(&reg),
        );
        let result = crate::ai::gemini::generate(
            &settings.api_key,
            &settings.model,
            Some(&system),
            &crate::ai::gemini::contents_from_history(&[("user", user.as_str())]),
            None,
            true,
            Some(3072),
            Some(40_000),
        )
        .await;
        if let Ok(out) = result {
            let mut cleaned = out.text.trim().to_string();
            if let Some(stripped) = cleaned.strip_prefix("```json") {
                cleaned = stripped.to_string();
            } else if let Some(stripped) = cleaned.strip_prefix("```JSON") {
                cleaned = stripped.to_string();
            } else if let Some(stripped) = cleaned.strip_prefix("```") {
                cleaned = stripped.to_string();
            }
            while cleaned.starts_with(char::is_whitespace) {
                cleaned.remove(0);
            }
            if cleaned.ends_with("```") {
                cleaned.truncate(cleaned.len() - 3);
            }
            if let Ok(parsed) = serde_json::from_str::<Value>(cleaned.trim()) {
                let mut input = parsed.as_object().cloned().unwrap_or_default();
                input.insert("source".into(), json!("ai"));
                if let Some(plan) = normalize_plan_input(&Value::Object(input), locale, &reg) {
                    if let Some(saved) = insert_active(st, user_id, &plan).await {
                        return Ok((Some(saved), "ai"));
                    }
                }
            }
        } else if let Err(e) = result {
            eprintln!("[plans] AI generation failed → rule-based fallback: {e}");
        }
    }

    let fallback = rule_based_plan(answers, locale, &reg);
    let saved = insert_active(st, user_id, &fallback).await;
    Ok((saved, "rules"))
}

/// Deterministic fallback so the questionnaire ALWAYS produces a plan.
fn rule_based_plan(answers: &Value, locale: &str, reg: &[(String, String, String)]) -> Value {
    let base = default_plan(locale, reg);
    let ex_name = |code: &str| registry_get(reg, code).map(|(_, n, _)| n.clone()).unwrap_or_else(|| code.to_string());
    let days_wanted = clamp(
        answers.get("days").and_then(|d| d.as_f64()).unwrap_or(f64::NAN),
        2.0,
        6.0,
        3,
    );
    let experience = answers
        .get("experience")
        .and_then(|e| e.as_str())
        .unwrap_or("")
        .to_lowercase();
    let goal = answers.get("goal").and_then(|g| g.as_str()).unwrap_or("").to_lowercase();

    let (l_en, l_ru, l_az) = if experience.contains("adv") || experience.contains("ileri") || experience.contains("продолж") {
        ("Advanced", "Продвинутый", "İleri")
    } else if experience.contains("int") || experience.contains("orta") || experience.contains("средн") {
        ("Intermediate", "Средний", "Orta")
    } else {
        ("Beginner", "Начальный", "Başlanğıc")
    };
    let level = match locale {
        "en" => l_en,
        "ru" => l_ru,
        _ => l_az,
    };
    let strength_bias = ["muscle", "güc", "mass", "kütlə", "мышц", "масс"].iter().any(|n| goal.contains(n));

    let mut extra: Vec<Value> = Vec::new();
    if days_wanted >= 4 {
        let focus = match locale {
            "ru" => "Верх тела",
            "en" => "Upper body",
            _ => "Bədənin üstü",
        };
        extra.push(json!({
            "day": 2,
            "focus": focus,
            "exercises": [
                { "ex": "pullup", "name": ex_name("pullup"), "sets": 4, "reps": "6–10", "rest": 90 },
                { "ex": "ohp", "name": ex_name("ohp"), "sets": 4, "reps": "8–10", "rest": 90 },
                { "ex": "latpull", "name": ex_name("latpull"), "sets": 3, "reps": "10–12", "rest": 75 },
                { "ex": "triceps", "name": ex_name("triceps"), "sets": 3, "reps": "10–12", "rest": 60 },
            ],
        }));
    }
    if days_wanted >= 5 {
        let focus = match locale {
            "ru" => "Низ тела",
            "en" => "Lower body",
            _ => "Bədənin altı",
        };
        extra.push(json!({
            "day": 4,
            "focus": focus,
            "exercises": [
                { "ex": "deadlift", "name": ex_name("deadlift"), "sets": 4, "reps": "6–8", "rest": 120 },
                { "ex": "legpress", "name": ex_name("legpress"), "sets": 4, "reps": "10–12", "rest": 90 },
                { "ex": "lunge", "name": ex_name("lunge"), "sets": 3, "reps": "10 (hər ayaq)", "rest": 75 },
                { "ex": "plank", "name": ex_name("plank"), "sets": 3, "reps": "40 s", "rest": 60 },
            ],
        }));
    }

    let strength_label = match locale {
        "en" => "strength focus",
        "ru" => "силовой фокус",
        _ => "güc fokuslu",
    };
    let answer_focus = answers.get("focus").and_then(|f| f.as_str()).map(String::from);
    let mut focus_parts: Vec<String> = Vec::new();
    if let Some(f) = answer_focus {
        if !f.is_empty() {
            focus_parts.push(f);
        }
    }
    if strength_bias {
        focus_parts.push(strength_label.to_string());
    }
    let focus_line = focus_parts.join(" · ");

    let mut days = base.get("days").and_then(|d| d.as_array().cloned()).unwrap_or_default();
    days.extend(extra);
    days.sort_by_key(|d| d.get("day").and_then(|d| d.as_i64()).unwrap_or(1));
    days.truncate(std::cmp::min(5, std::cmp::max(3, days_wanted as usize)));

    let title = match locale {
        "ru" => "Личный план",
        "en" => "Personal plan",
        _ => "Şəxsi plan",
    };
    let mut out = base;
    let obj = out.as_object_mut().unwrap();
    obj.insert("title".into(), json!(title));
    obj.insert("level".into(), json!(level));
    obj.insert("source".into(), json!("ai"));
    if !focus_line.is_empty() {
        obj.insert("focus".into(), json!(focus_line));
    }
    obj.insert("days".into(), json!(days));
    out
}

/// Normalize a plan that arrived through the AI CHAT tool.
pub async fn save_chat_plan(st: &St, user_id: &str, raw: &Value, locale: &str) -> Option<Value> {
    let reg = load_exercise_registry(st, locale).await;
    let mut input = raw.as_object().cloned().unwrap_or_default();
    input.insert("source".into(), json!("ai"));
    let plan = normalize_plan_input(&Value::Object(input), locale, &reg)?;
    insert_active(st, user_id, &plan).await
}
