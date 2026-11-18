use serde_json::Value;

/// Baku wall-clock helpers — Azerbaijan runs UTC+4 year-round (no DST
/// since 2016). Mirrors src/lib/psychology.ts exactly.
pub const BAKU_OFFSET_SECS: i64 = 4 * 60 * 60;

pub struct BakuParts {
    /// "YYYY-MM-DD"
    pub date: String,
    /// 0–23
    pub hour: u32,
    /// Mon=1 … Sun=7
    pub weekday: u32,
}

pub fn baku_parts(now: chrono::DateTime<chrono::Utc>) -> BakuParts {
    use chrono::{Datelike, Timelike};
    let shifted = now + chrono::Duration::seconds(BAKU_OFFSET_SECS);
    BakuParts {
        date: shifted.format("%Y-%m-%d").to_string(),
        hour: shifted.hour(),
        weekday: shifted.weekday().num_days_from_monday() + 1,
    }
}

/// UTC instant of a Baku wall-clock date ("YYYY-MM-DD") + hour.
pub fn baku_instant(date: &str, hour: u32) -> Option<chrono::DateTime<chrono::Utc>> {
    let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let naive = d.and_hms_opt(hour, 0, 0)?;
    Some(chrono::DateTime::from_timestamp(naive.and_utc().timestamp() - BAKU_OFFSET_SECS, 0)?)
}

/// Day-shift of a date string ("YYYY-MM-DD" → ±N days).
pub fn shift_date(date: &str, days: i64) -> Option<String> {
    let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    Some((d + chrono::Duration::days(days)).format("%Y-%m-%d").to_string())
}

/// Parse a PostgREST timestamptz string into a UTC instant.
pub fn parse_ts(v: &Value) -> Option<chrono::DateTime<chrono::Utc>> {
    v.as_str().and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&chrono::Utc))
}

/// Consecutive-day streak ending today or yesterday, from mood log dates.
pub fn mood_streak(dates: &[String]) -> usize {
    use std::collections::HashSet;
    let set: HashSet<&str> = dates.iter().map(|s| s.as_str()).collect();
    let today = baku_parts(chrono::Utc::now()).date;
    let mut cursor = match chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return 0,
    };
    if !set.contains(cursor.format("%Y-%m-%d").to_string().as_str()) {
        cursor -= chrono::Duration::days(1);
        if !set.contains(cursor.format("%Y-%m-%d").to_string().as_str()) {
            return 0;
        }
    }
    let mut streak = 0;
    while set.contains(cursor.format("%Y-%m-%d").to_string().as_str()) {
        streak += 1;
        cursor -= chrono::Duration::days(1);
    }
    streak
}

/// Numeric passthrough that keeps JS-style serialization: 18.00 → 18.
pub fn num(v: &Value) -> Value {
    if let Some(f) = v.as_f64() {
        if f.fract() == 0.0 && f.abs() < 9.0e15 {
            return Value::from(f as i64);
        }
        return Value::from(f);
    }
    v.clone()
}
