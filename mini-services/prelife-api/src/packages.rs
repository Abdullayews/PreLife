//! Custom subscription packages — port of lib/server/packages.ts. The
//! price is computed SERVER-SIDE from the picked features + duration.

use crate::error::{ApiError, DomainError};
use crate::state::St;
use crate::util::*;
use serde_json::{json, Value};

type Res<T> = Result<T, DomainError>;

pub const PACKAGE_MONTHS: &[i64] = &[1, 3, 6, 12];

pub fn months_discount(months: i64) -> f64 {
    if months >= 12 {
        0.85
    } else if months >= 6 {
        0.9
    } else if months >= 3 {
        0.95
    } else {
        1.0
    }
}

async fn feature_prices(st: &St) -> Res<Vec<(String, f64)>> {
    let rows = st
        .supa
        .select(
            "subscription_features",
            &vec![("select".into(), "code,price".into()), ("order".into(), "sort_order.asc".into())],
        )
        .await
        .map_err(DomainError::from_supa)?;
    Ok(rows
        .iter()
        .filter_map(|r| {
            let rv = Value::Object(r.clone());
            match (s_opt(&rv, "code"), n_opt(&rv, "price")) {
                (Some(c), Some(p)) => Some((c, p)),
                _ => None,
            }
        })
        .collect())
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

pub async fn quote_package(st: &St, feature_codes: &Value, months: &Value) -> Res<Value> {
    let Some(list) = feature_codes.as_array() else {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "features")));
    };
    if list.is_empty() || list.iter().any(|c| !c.is_string()) {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "features")));
    }
    let m = match months {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    };
    let Some(m) = m else {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "months")));
    };
    let m_int = m as i64;
    if m.fract() != 0.0 || !PACKAGE_MONTHS.contains(&m_int) {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "months")));
    }

    let prices = feature_prices(st).await?;
    let mut unique: Vec<String> = Vec::new();
    for c in list.iter().filter_map(|c| c.as_str()) {
        if !unique.iter().any(|u| u == c) {
            unique.push(c.to_string());
        }
    }
    let unknown: Vec<&String> = unique
        .iter()
        .filter(|c| !prices.iter().any(|(code, _)| code == *c))
        .collect();
    if !unknown.is_empty() {
        return Err(DomainError::Api(ApiError::new(axum::http::StatusCode::BAD_REQUEST, "unknown_feature")));
    }

    let monthly: f64 = unique
        .iter()
        .map(|c| prices.iter().find(|(code, _)| code == c).map(|(_, p)| *p).unwrap_or(0.0))
        .sum();
    let discount = months_discount(m_int);
    let total = round2(monthly * m_int as f64 * discount);
    Ok(json!({
        "features": unique,
        "months": m_int,
        "monthlyPrice": round2(monthly),
        "discountPct": ((1.0 - discount) * 100.0).round() as i64,
        "totalPrice": total,
    }))
}

pub async fn create_custom_package(st: &St, user_id: &str, feature_codes: &Value, months: &Value) -> Res<Value> {
    let quote = quote_package(st, feature_codes, months).await?;
    let row = st
        .supa
        .insert(
            "custom_packages",
            &json!({
                "user_id": user_id,
                "features": quote.get("features").cloned().unwrap_or(json!([])),
                "months": quote.get("months").cloned().unwrap_or(json!(1)),
                "monthly_price": quote.get("monthlyPrice").cloned().unwrap_or(json!(0)),
                "total_price": quote.get("totalPrice").cloned().unwrap_or(json!(0)),
                "status": "requested",
            }),
        )
        .await
        .map_err(DomainError::from_supa)?;
    let rv = row.map(|r| Value::Object(r)).unwrap_or(json!({}));
    Ok(json!({
        "id": s(&rv, "id"),
        "features": quote.get("features").cloned().unwrap_or(json!([])),
        "months": quote.get("months").cloned().unwrap_or(json!(1)),
        "monthlyPrice": quote.get("monthlyPrice").cloned().unwrap_or(json!(0)),
        "totalPrice": quote.get("totalPrice").cloned().unwrap_or(json!(0)),
        "status": "requested",
        "createdAt": s_opt(&rv, "created_at").unwrap_or_else(now_iso),
    }))
}

pub async fn list_custom_packages(st: &St, user_id: &str) -> Vec<Value> {
    let rows = st
        .supa
        .select(
            "custom_packages",
            &vec![
                ("select".into(), "*".into()),
                ("user_id".into(), format!("eq.{user_id}")),
                ("order".into(), "created_at.desc".into()),
            ],
        )
        .await;
    match rows {
        Ok(rows) => rows
            .iter()
            .map(|r| {
                let rv = Value::Object(r.clone());
                let stt = s(&rv, "status");
                let status = if stt.is_empty() { "requested".to_string() } else { stt };
                json!({
                    "id": s(&rv, "id"),
                    "features": rv.get("features").and_then(|f| f.as_array().cloned()).unwrap_or_default(),
                    "months": i64_opt(&rv, "months").unwrap_or(1),
                    "monthlyPrice": n_opt(&rv, "monthly_price").unwrap_or(0.0),
                    "totalPrice": n_opt(&rv, "total_price").unwrap_or(0.0),
                    "status": status,
                    "createdAt": s(&rv, "created_at"),
                })
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// One-line subscription summary for the AI context prompt.
pub async fn package_summary_line(st: &St, user_id: &str) -> String {
    let list = list_custom_packages(st, user_id).await;
    if list.is_empty() {
        return "free tier, no custom package yet".to_string();
    }
    let latest = &list[0];
    let features: Vec<String> = latest
        .get("features")
        .and_then(|f| f.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    format!(
        "custom package request: {} for {} months ({} ₼ total, status: {})",
        features.join("+"),
        latest.get("months").map(|m| m.to_string()).unwrap_or_default(),
        latest
            .get("totalPrice")
            .and_then(|t| t.as_f64())
            .map(crate::mail::format_price)
            .unwrap_or_default(),
        latest.get("status").and_then(|s| s.as_str()).unwrap_or("requested"),
    )
}
