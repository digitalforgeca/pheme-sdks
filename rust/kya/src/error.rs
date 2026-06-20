//! Error types for the KYA SDK.

use thiserror::Error;

/// All errors that can be returned by the KYA SDK.
#[derive(Debug, Error)]
pub enum KyaError {
    /// The request was rate-limited. Contains the number of seconds to wait before retrying.
    #[error("Rate limited — retry after {retry_after_secs}s")]
    RateLimit {
        /// Seconds to wait before retrying, as indicated by the server.
        retry_after_secs: u64,
    },

    /// Authentication failed (invalid or missing API key / JWT).
    #[error("Authentication failed: {message}")]
    Auth {
        /// Human-readable description.
        message: String,
    },

    /// The requested resource was not found.
    #[error("Not found: {resource}")]
    NotFound {
        /// Description of the missing resource.
        resource: String,
    },

    /// The API returned an unexpected HTTP error status.
    #[error("API error {status}: {message}")]
    Api {
        /// HTTP status code.
        status: u16,
        /// Human-readable message from the response body.
        message: String,
    },

    /// A network or transport-level error occurred.
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    /// The response body could not be decoded.
    #[error("Deserialization error: {0}")]
    Deserialize(String),

    /// The provided configuration is invalid.
    #[error("Invalid configuration: {0}")]
    Config(String),
}

impl KyaError {
    /// Returns `true` if this error indicates a rate-limit condition.
    pub fn is_rate_limit(&self) -> bool {
        matches!(self, Self::RateLimit { .. })
    }

    /// Returns `true` if this error indicates an auth failure.
    pub fn is_auth(&self) -> bool {
        matches!(self, Self::Auth { .. })
    }

    /// Returns `true` if the resource was not found.
    pub fn is_not_found(&self) -> bool {
        matches!(self, Self::NotFound { .. })
    }

    /// If this is a [`KyaError::RateLimit`], returns the retry-after seconds.
    pub fn retry_after_secs(&self) -> Option<u64> {
        match self {
            Self::RateLimit { retry_after_secs } => Some(*retry_after_secs),
            _ => None,
        }
    }
}
