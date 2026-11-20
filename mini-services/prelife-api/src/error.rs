//! ApiError — the Rust port of the merged app's ApiCode: every domain
//! error is `{ status, code }` and renders as `{ "error": code }` JSON.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

#[derive(Debug, Clone)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: String,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &str) -> Self {
        Self { status, code: code.to_string() }
    }
    pub fn bad_request() -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid")
    }
    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "unauthorized")
    }
    pub fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found")
    }
    #[allow(dead_code)]
    pub fn generic() -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "generic")
    }
    pub fn json(status: u16, code: &str) -> Self {
        let st = StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        Self::new(st, code)
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "api error {}: {}", self.status, self.code)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(serde_json::json!({ "error": self.code }))).into_response()
    }
}

/// The domain error — mirrors the TS backend exactly: functions throw
/// either ApiCode ({ status, code }, rendered by the route layer) or a
/// plain Error whose MESSAGE the callers match on ("gotrue 422: …",
/// "invalid_grant", …). This enum carries both, and routes translate it
/// with to_error_response().
#[derive(Debug, Clone)]
pub enum DomainError {
    Api(ApiError),
    Msg(String),
}

impl DomainError {
    pub fn msg(m: impl Into<String>) -> Self {
        DomainError::Msg(m.into())
    }
    pub fn from_supa(e: SupaError) -> Self {
        DomainError::Msg(e.message())
    }
    pub fn message(&self) -> String {
        match self {
            DomainError::Api(a) => a.code.clone(),
            DomainError::Msg(m) => m.clone(),
        }
    }
    pub fn into_response_parts(self) -> (StatusCode, String) {
        match self {
            DomainError::Api(a) => (a.status, a.code),
            DomainError::Msg(m) => {
                eprintln!("[api] unexpected error: {m}");
                (StatusCode::INTERNAL_SERVER_ERROR, "generic".to_string())
            }
        }
    }
}

impl From<ApiError> for DomainError {
    fn from(a: ApiError) -> Self {
        DomainError::Api(a)
    }
}

impl std::fmt::Display for DomainError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message())
    }
}

impl IntoResponse for DomainError {
    fn into_response(self) -> Response {
        let (status, code) = self.into_response_parts();
        (status, Json(serde_json::json!({ "error": code }))).into_response()
    }
}

/// The supa layer's transport error — mirrors the TS client's
/// "supabase {status}: {body}" / "gotrue {status}: {body}" message
/// strings so the domain logic can match on status + body text exactly
/// like the ported code did.
#[derive(Debug, Clone)]
pub struct SupaError {
    pub status: u16,
    pub body: String,
    /// "gotrue" (auth) or "supabase" (rest) — used in the display string.
    pub kind: &'static str,
}

#[allow(dead_code)]
impl SupaError {
    pub fn rest(status: u16, body: String) -> Self {
        Self { status, body, kind: "supabase" }
    }
    pub fn gotrue(status: u16, body: String) -> Self {
        Self { status, body, kind: "gotrue" }
    }
    pub fn message(&self) -> String {
        format!("{} {}: {}", self.kind, self.status, self.body)
    }
    pub fn contains(&self, needle: &str) -> bool {
        self.message().contains(needle)
    }
    pub fn status_is(&self, status: u16) -> bool {
        self.status == status
    }
}

impl std::fmt::Display for SupaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message())
    }
}
