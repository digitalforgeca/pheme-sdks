//! Error types for the Pheme SDK.

use thiserror::Error;

/// All errors that can occur when using the Pheme SDK.
#[derive(Debug, Error)]
pub enum PhemeError {
    /// The server returned a 400 Bad Request.
    #[error("bad request ({status}): {message}")]
    BadRequest { status: u16, message: String },

    /// Authentication failed (401 Unauthorized).
    #[error("authentication failed: {message}")]
    Auth { message: String },

    /// The caller does not have permission to perform this action (403 Forbidden).
    #[error("forbidden: {message}")]
    Forbidden { message: String },

    /// The requested resource could not be found (404 Not Found).
    #[error("not found: {message}")]
    NotFound { message: String },

    /// The request was rate-limited (429 Too Many Requests).
    #[error("rate limited — retry after {retry_after_secs}s")]
    RateLimit {
        /// Number of seconds to wait before retrying.
        retry_after_secs: u64,
    },

    /// An unexpected API error (5xx or unrecognised 4xx).
    #[error("api error {status}: {message}")]
    Api { status: u16, message: String },

    /// A transport-level error (DNS failure, connection refused, timeout, etc.).
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),

    /// The response body could not be decoded as the expected type.
    #[error("failed to decode response: {0}")]
    Decode(String),

    /// A URL could not be parsed (typically a bad base URL in config).
    #[error("invalid url: {0}")]
    Url(#[from] url::ParseError),
}

/// `Result` alias for Pheme SDK operations.
pub type PhemeResult<T> = Result<T, PhemeError>;
