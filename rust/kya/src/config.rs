//! Client configuration for the KYA SDK.

use crate::error::KyaError;

/// Default base URL for the Pheme / KYA API.
pub const DEFAULT_BASE_URL: &str = "https://pheme.ca/api/v1";

/// Default request timeout in seconds.
pub const DEFAULT_TIMEOUT_SECS: u64 = 30;

/// Default maximum retry attempts on rate-limit responses.
pub const DEFAULT_MAX_RETRIES: u32 = 3;

/// Configuration for [`KyaClient`](crate::KyaClient).
#[derive(Debug, Clone)]
pub struct KyaClientConfig {
    /// Base URL for the API (default: `"https://pheme.ca/api/v1"`).
    pub base_url: String,

    /// Optional API key sent as `X-API-Key` header.
    pub api_key: Option<String>,

    /// Optional JWT token sent as `Authorization: Bearer <token>`.
    pub jwt: Option<String>,

    /// Request timeout in seconds.
    pub timeout_secs: u64,

    /// Maximum number of automatic retries on 429 Rate Limited responses.
    pub max_retries: u32,
}

impl Default for KyaClientConfig {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
            api_key: None,
            jwt: None,
            timeout_secs: DEFAULT_TIMEOUT_SECS,
            max_retries: DEFAULT_MAX_RETRIES,
        }
    }
}

impl KyaClientConfig {
    /// Returns a new [`KyaClientConfigBuilder`].
    pub fn builder() -> KyaClientConfigBuilder {
        KyaClientConfigBuilder::default()
    }

    /// Validate the configuration.
    pub(crate) fn validate(&self) -> Result<(), KyaError> {
        if self.base_url.is_empty() {
            return Err(KyaError::Config("base_url must not be empty".into()));
        }
        if self.timeout_secs == 0 {
            return Err(KyaError::Config("timeout_secs must be > 0".into()));
        }
        Ok(())
    }
}

/// Builder for [`KyaClientConfig`].
///
/// ## Example
///
/// ```
/// use kya_sdk::KyaClientConfig;
///
/// let config = KyaClientConfig::builder()
///     .api_key("phm_your_api_key_here")
///     .timeout_secs(15)
///     .build();
/// ```
#[derive(Debug, Default)]
pub struct KyaClientConfigBuilder {
    base_url: Option<String>,
    api_key: Option<String>,
    jwt: Option<String>,
    timeout_secs: Option<u64>,
    max_retries: Option<u32>,
}

impl KyaClientConfigBuilder {
    /// Override the API base URL (default: `"https://pheme.ca/api/v1"`).
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    /// Set the API key for authenticated requests (`X-API-Key` header).
    pub fn api_key(mut self, key: impl Into<String>) -> Self {
        self.api_key = Some(key.into());
        self
    }

    /// Set a JWT token for authenticated requests (`Authorization: Bearer` header).
    pub fn jwt(mut self, token: impl Into<String>) -> Self {
        self.jwt = Some(token.into());
        self
    }

    /// Override the request timeout (default: 30 seconds).
    pub fn timeout_secs(mut self, secs: u64) -> Self {
        self.timeout_secs = Some(secs);
        self
    }

    /// Override the maximum number of automatic retries on 429 (default: 3).
    pub fn max_retries(mut self, retries: u32) -> Self {
        self.max_retries = Some(retries);
        self
    }

    /// Build the [`KyaClientConfig`].
    pub fn build(self) -> KyaClientConfig {
        KyaClientConfig {
            base_url: self
                .base_url
                .unwrap_or_else(|| DEFAULT_BASE_URL.to_string()),
            api_key: self.api_key,
            jwt: self.jwt,
            timeout_secs: self.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS),
            max_retries: self.max_retries.unwrap_or(DEFAULT_MAX_RETRIES),
        }
    }
}
