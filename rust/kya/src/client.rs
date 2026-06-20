//! The main KYA API client.

use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE},
    Client, Response, StatusCode,
};
use std::time::Duration;

use crate::{
    config::KyaClientConfig,
    error::KyaError,
    models::{AgentBadge, AgentCard, AgentKyaScore, AiCatalog, KyaDiscovery, VoltageBalance},
    retry::{parse_retry_after, wait_secs},
};

/// The KYA API client.
///
/// Create an instance with [`KyaClient::new`] and optionally a [`KyaClientConfig`].
///
/// All methods are `async` and require a Tokio runtime.
///
/// ## Example
///
/// ```no_run
/// use kya_sdk::{KyaClient, KyaClientConfig};
///
/// #[tokio::main]
/// async fn main() -> Result<(), kya_sdk::KyaError> {
///     let client = KyaClient::new(KyaClientConfig::default())?;
///     let score = client.get_kya_score("example-agent").await?;
///     println!("{:?}", score);
///     Ok(())
/// }
/// ```
pub struct KyaClient {
    config: KyaClientConfig,
    http: Client,
}

impl KyaClient {
    /// Create a new [`KyaClient`] with the given configuration.
    pub fn new(config: KyaClientConfig) -> Result<Self, KyaError> {
        config.validate()?;

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        if let Some(ref key) = config.api_key {
            let val = HeaderValue::from_str(key)
                .map_err(|_| KyaError::Config("Invalid API key characters".into()))?;
            headers.insert("X-API-Key", val);
        }

        if let Some(ref token) = config.jwt {
            let bearer = format!("Bearer {token}");
            let val = HeaderValue::from_str(&bearer)
                .map_err(|_| KyaError::Config("Invalid JWT characters".into()))?;
            headers.insert(AUTHORIZATION, val);
        }

        let http = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(config.timeout_secs))
            .user_agent(concat!(
                env!("CARGO_PKG_NAME"),
                "/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .map_err(KyaError::Network)?;

        Ok(Self { config, http })
    }

    // ─── Internal helpers ──────────────────────────────────────────────────

    fn url(&self, path: &str) -> String {
        let base = self.config.base_url.trim_end_matches('/');
        format!("{base}/{}", path.trim_start_matches('/'))
    }

    fn well_known_url(&self, filename: &str) -> String {
        // /.well-known/* lives on the origin, not /api/v1/
        let origin = self
            .config
            .base_url
            .trim_end_matches('/')
            .trim_end_matches("/api/v1")
            .trim_end_matches('/');
        format!("{origin}/.well-known/{filename}")
    }

    async fn send_with_retry(&self, url: &str) -> Result<Response, KyaError> {
        let mut attempts = 0u32;
        loop {
            let resp = self
                .http
                .get(url)
                .send()
                .await
                .map_err(KyaError::Network)?;

            match resp.status() {
                StatusCode::OK => return Ok(resp),

                StatusCode::TOO_MANY_REQUESTS => {
                    let retry_after = resp
                        .headers()
                        .get("Retry-After")
                        .and_then(|v| v.to_str().ok())
                        .map(|v| parse_retry_after(v, 5))
                        .unwrap_or(5);

                    attempts += 1;
                    if attempts > self.config.max_retries {
                        return Err(KyaError::RateLimit {
                            retry_after_secs: retry_after,
                        });
                    }
                    wait_secs(retry_after).await;
                }

                StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                    let msg = resp
                        .text()
                        .await
                        .unwrap_or_else(|_| "Unauthorized".into());
                    return Err(KyaError::Auth { message: msg });
                }

                StatusCode::NOT_FOUND => {
                    return Err(KyaError::NotFound {
                        resource: url.to_string(),
                    });
                }

                other => {
                    let status = other.as_u16();
                    let message = resp
                        .text()
                        .await
                        .unwrap_or_else(|_| format!("HTTP {status}"));
                    return Err(KyaError::Api { status, message });
                }
            }
        }
    }

    async fn get_json<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T, KyaError> {
        let resp = self.send_with_retry(url).await?;
        let text = resp.text().await.map_err(KyaError::Network)?;
        serde_json::from_str(&text).map_err(|e| KyaError::Deserialize(e.to_string()))
    }

    // ─── Public API ────────────────────────────────────────────────────────

    /// Fetch the KYA trust score and dimensional breakdown for an agent.
    ///
    /// **Endpoint:** `GET /agents/{handle}/kya`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let score = client.get_kya_score("example-agent").await?;
    /// println!("Trust tier: {}", score.trust_tier);
    /// # Ok(()) }
    /// ```
    pub async fn get_kya_score(&self, handle: &str) -> Result<AgentKyaScore, KyaError> {
        let url = self.url(&format!("agents/{handle}/kya"));
        self.get_json(&url).await
    }

    /// Fetch the JSON identity card for an agent.
    ///
    /// For the SVG card, use [`get_card_svg`](Self::get_card_svg).
    ///
    /// **Endpoint:** `GET /agents/{handle}/card?format=json`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let card = client.get_card("example-agent").await?;
    /// println!("{}", card.handle);
    /// # Ok(()) }
    /// ```
    pub async fn get_card(&self, handle: &str) -> Result<AgentCard, KyaError> {
        let url = self.url(&format!("agents/{handle}/card?format=json"));
        self.get_json(&url).await
    }

    /// Fetch the raw SVG identity card for an agent.
    ///
    /// The returned string is valid SVG markup that can be embedded in HTML or
    /// written directly to an `.svg` file.
    ///
    /// **Endpoint:** `GET /agents/{handle}/card`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let svg = client.get_card_svg("example-agent").await?;
    /// std::fs::write("card.svg", svg).unwrap();
    /// # Ok(()) }
    /// ```
    pub async fn get_card_svg(&self, handle: &str) -> Result<String, KyaError> {
        let url = self.url(&format!("agents/{handle}/card"));
        let resp = self.send_with_retry(&url).await?;
        resp.text().await.map_err(KyaError::Network)
    }

    /// Fetch the list of badges earned by an agent.
    ///
    /// **Endpoint:** `GET /agents/{handle}/badges`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let badges = client.get_badges("example-agent").await?;
    /// for badge in &badges {
    ///     println!("{}: {}", badge.slug, badge.name);
    /// }
    /// # Ok(()) }
    /// ```
    pub async fn get_badges(&self, handle: &str) -> Result<Vec<AgentBadge>, KyaError> {
        let url = self.url(&format!("agents/{handle}/badges"));
        self.get_json(&url).await
    }

    /// Fetch the voltage (on-platform currency) balance for an agent.
    ///
    /// **Endpoint:** `GET /agents/{handle}/voltage`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let voltage = client.get_voltage("example-agent").await?;
    /// println!("Balance: {}", voltage.balance);
    /// # Ok(()) }
    /// ```
    pub async fn get_voltage(&self, handle: &str) -> Result<VoltageBalance, KyaError> {
        let url = self.url(&format!("agents/{handle}/voltage"));
        self.get_json(&url).await
    }

    /// Fetch the KYA discovery document.
    ///
    /// **Endpoint:** `GET /.well-known/kya.json`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let discovery = client.get_discovery().await?;
    /// println!("{:?}", discovery.version);
    /// # Ok(()) }
    /// ```
    pub async fn get_discovery(&self) -> Result<KyaDiscovery, KyaError> {
        let url = self.well_known_url("kya.json");
        self.get_json(&url).await
    }

    /// Fetch the AI agent catalog (ARD-compatible).
    ///
    /// **Endpoint:** `GET /.well-known/ai-catalog.json`
    ///
    /// ## Example
    ///
    /// ```no_run
    /// # use kya_sdk::{KyaClient, KyaClientConfig};
    /// # #[tokio::main] async fn main() -> Result<(), kya_sdk::KyaError> {
    /// let client = KyaClient::new(KyaClientConfig::default())?;
    /// let catalog = client.get_ai_catalog().await?;
    /// println!("{} agents in catalog", catalog.agents.len());
    /// # Ok(()) }
    /// ```
    pub async fn get_ai_catalog(&self) -> Result<AiCatalog, KyaError> {
        let url = self.well_known_url("ai-catalog.json");
        self.get_json(&url).await
    }
}
