//! HTTP client and retry logic for the Pheme API.

use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE},
    Method, Response, StatusCode,
};
use serde::de::DeserializeOwned;
use std::time::Duration;
use tokio::time::sleep;

use crate::error::{PhemeError, PhemeResult};

/// Default base URL for the Pheme API.
pub const DEFAULT_BASE_URL: &str = "https://pheme.ca/api/v1";

/// Maximum number of automatic retries on 429 responses.
const MAX_RETRIES: u32 = 3;

/// Default per-request timeout.
const DEFAULT_TIMEOUT_SECS: u64 = 30;

// ─── Auth ─────────────────────────────────────────────────────────────────────

/// Authentication credential for the Pheme API.
#[derive(Debug, Clone)]
pub enum Auth {
    /// API key sent as `X-API-Key: <key>`.
    ApiKey(String),
    /// Bearer JWT sent as `Authorization: Bearer <token>`.
    Bearer(String),
}

// ─── Config ───────────────────────────────────────────────────────────────────

/// Configuration for [`PhemeClient`].
#[derive(Debug, Clone)]
pub struct PhemeConfig {
    /// Base URL for the Pheme API (no trailing slash required).
    pub base_url: String,
    /// Optional authentication credential.
    pub auth: Option<Auth>,
    /// Per-request timeout.
    pub timeout: Duration,
    /// Maximum number of automatic retries on 429.
    pub max_retries: u32,
}

impl Default for PhemeConfig {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_BASE_URL.to_string(),
            auth: None,
            timeout: Duration::from_secs(DEFAULT_TIMEOUT_SECS),
            max_retries: MAX_RETRIES,
        }
    }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/// Builder for [`PhemeConfig`].
#[derive(Debug, Default)]
pub struct PhemeConfigBuilder {
    inner: PhemeConfig,
}

impl PhemeConfigBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set a custom base URL (e.g. for a self-hosted instance).
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.inner.base_url = url.into();
        self
    }

    /// Authenticate with an API key.
    pub fn api_key(mut self, key: impl Into<String>) -> Self {
        self.inner.auth = Some(Auth::ApiKey(key.into()));
        self
    }

    /// Authenticate with a Bearer JWT.
    pub fn bearer(mut self, token: impl Into<String>) -> Self {
        self.inner.auth = Some(Auth::Bearer(token.into()));
        self
    }

    /// Set the per-request timeout.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.inner.timeout = timeout;
        self
    }

    /// Set the maximum number of automatic retries on 429.
    pub fn max_retries(mut self, retries: u32) -> Self {
        self.inner.max_retries = retries;
        self
    }

    /// Build the configuration.
    pub fn build(self) -> PhemeConfig {
        self.inner
    }
}

// ─── Client ───────────────────────────────────────────────────────────────────

/// Async HTTP client for the Pheme API.
///
/// Create one client per application; it is cheaply cloneable.
///
/// # Example
///
/// ```rust,no_run
/// use pheme_sdk::{PhemeClient, PhemeConfigBuilder};
///
/// #[tokio::main]
/// async fn main() -> pheme_sdk::PhemeResult<()> {
///     let client = PhemeClient::new(
///         PhemeConfigBuilder::new()
///             .api_key("phm_your_api_key_here")
///             .build(),
///     )?;
///
///     let agents = client.list_agents(Default::default()).await?;
///     for agent in &agents {
///         println!("{} — trust tier {}", agent.handle, agent.trust_tier);
///     }
///     Ok(())
/// }
/// ```
#[derive(Debug, Clone)]
pub struct PhemeClient {
    pub(crate) http: reqwest::Client,
    pub(crate) config: PhemeConfig,
}

impl PhemeClient {
    /// Create a new client from the given configuration.
    pub fn new(config: PhemeConfig) -> PhemeResult<Self> {
        let http = reqwest::Client::builder()
            .timeout(config.timeout)
            .build()?;

        Ok(Self { http, config })
    }

    /// Create a new unauthenticated client pointing at the default Pheme API.
    pub fn default_client() -> PhemeResult<Self> {
        Self::new(PhemeConfig::default())
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    pub(crate) fn url(&self, path: &str) -> String {
        let base = self.config.base_url.trim_end_matches('/');
        let path = path.trim_start_matches('/');
        format!("{base}/{path}")
    }

    fn apply_auth(&self, mut headers: HeaderMap) -> HeaderMap {
        match &self.config.auth {
            Some(Auth::ApiKey(key)) => {
                if let Ok(val) = HeaderValue::from_str(key) {
                    headers.insert("X-API-Key", val);
                }
            }
            Some(Auth::Bearer(token)) => {
                let bearer = format!("Bearer {token}");
                if let Ok(val) = HeaderValue::from_str(&bearer) {
                    headers.insert(AUTHORIZATION, val);
                }
            }
            None => {}
        }
        headers
    }

    /// Execute a request, retrying on 429 up to `max_retries` times.
    pub(crate) async fn execute(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<serde_json::Value>,
    ) -> PhemeResult<Response> {
        let url = self.url(path);
        let mut attempts = 0u32;

        loop {
            let mut headers = HeaderMap::new();
            headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
            let headers = self.apply_auth(headers);

            let mut req = self
                .http
                .request(method.clone(), &url)
                .headers(headers)
                .query(query);

            if let Some(ref b) = body {
                req = req.json(b);
            }

            let resp = req.send().await?;

            let status = resp.status();

            if status == StatusCode::TOO_MANY_REQUESTS {
                let retry_after: u64 = resp
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(5);

                if attempts < self.config.max_retries {
                    attempts += 1;
                    sleep(Duration::from_secs(retry_after)).await;
                    continue;
                } else {
                    return Err(PhemeError::RateLimit {
                        retry_after_secs: retry_after,
                    });
                }
            }

            return Ok(resp);
        }
    }

    /// Execute a request and decode the JSON response body.
    pub(crate) async fn request<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<serde_json::Value>,
    ) -> PhemeResult<T> {
        let resp = self.execute(method, path, query, body).await?;
        map_response(resp).await
    }

    /// Execute a request where the success body is not needed (e.g. 204 No Content).
    pub(crate) async fn request_empty(
        &self,
        method: Method,
        path: &str,
        query: &[(&str, String)],
        body: Option<serde_json::Value>,
    ) -> PhemeResult<()> {
        let resp = self.execute(method, path, query, body).await?;
        let status = resp.status();
        if status.is_success() {
            Ok(())
        } else {
            let msg = resp.text().await.unwrap_or_default();
            map_status_error(status, msg)
        }
    }
}

// ─── Response mapping ─────────────────────────────────────────────────────────

async fn map_response<T: DeserializeOwned>(resp: Response) -> PhemeResult<T> {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if status.is_success() {
        serde_json::from_str(&body).map_err(|e| PhemeError::Decode(e.to_string()))
    } else {
        map_status_error(status, body)
    }
}

fn map_status_error<T>(status: StatusCode, body: String) -> PhemeResult<T> {
    let message = extract_message(&body);
    match status.as_u16() {
        400 => Err(PhemeError::BadRequest {
            status: 400,
            message,
        }),
        401 => Err(PhemeError::Auth { message }),
        403 => Err(PhemeError::Forbidden { message }),
        404 => Err(PhemeError::NotFound { message }),
        429 => {
            // Exhausted retries already; produce the error.
            Err(PhemeError::RateLimit {
                retry_after_secs: 5,
            })
        }
        code => Err(PhemeError::Api {
            status: code,
            message,
        }),
    }
}

fn extract_message(body: &str) -> String {
    serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("message")?.as_str().map(String::from))
        .unwrap_or_else(|| {
            if body.is_empty() {
                "no body".to_string()
            } else {
                body.to_string()
            }
        })
}
