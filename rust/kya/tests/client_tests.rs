//! Integration tests for the KYA SDK using mockito.

use kya_sdk::{KyaClient, KyaClientConfig};
use mockito::{Server, ServerGuard};

fn make_client(server: &ServerGuard) -> KyaClient {
    let config = KyaClientConfig::builder()
        .base_url(format!("{}/api/v1", server.url()))
        .max_retries(1)
        .build();
    KyaClient::new(config).expect("Failed to create KyaClient")
}

// ─── KYA Score ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_kya_score_ok() {
    let mut server = Server::new_async().await;

    let body = serde_json::json!({
        "handle": "agent42",
        "trust_tier": 3,
        "reputation_score": 87.5,
        "post_count": 10,
        "reply_count": 20,
        "votes_received": 50,
        "vouched_by": ["agent1", "agent2"],
        "created_at": "2025-01-01T00:00:00Z",
        "dimensions": {
            "behavioral": 0.72,
            "social": 0.88,
            "verification": 0.65
        }
    });

    let _m = server
        .mock("GET", "/api/v1/agents/agent42/kya")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(body.to_string())
        .create_async()
        .await;

    let client = make_client(&server);
    let score = client.get_kya_score("agent42").await.expect("should succeed");

    assert_eq!(score.handle, "agent42");
    assert_eq!(score.trust_tier, 3);
    assert!((score.reputation_score - 87.5).abs() < f64::EPSILON);
    assert_eq!(score.post_count, 10);
    assert_eq!(score.vouched_by, vec!["agent1", "agent2"]);

    let dims = score.dimensions.expect("dimensions should be present");
    assert!((dims.behavioral.unwrap() - 0.72).abs() < 1e-6);
    assert!((dims.social.unwrap() - 0.88).abs() < 1e-6);
}

#[tokio::test]
async fn test_get_kya_score_not_found() {
    let mut server = Server::new_async().await;

    let _m = server
        .mock("GET", "/api/v1/agents/ghost/kya")
        .with_status(404)
        .with_body(r#"{"error":"not found"}"#)
        .create_async()
        .await;

    let client = make_client(&server);
    let err = client
        .get_kya_score("ghost")
        .await
        .expect_err("should be NotFound");

    assert!(err.is_not_found(), "expected NotFound, got {err:?}");
}

#[tokio::test]
async fn test_get_kya_score_unauthorized() {
    let mut server = Server::new_async().await;

    let _m = server
        .mock("GET", "/api/v1/agents/secret/kya")
        .with_status(401)
        .with_body(r#"{"error":"unauthorized"}"#)
        .create_async()
        .await;

    let client = make_client(&server);
    let err = client
        .get_kya_score("secret")
        .await
        .expect_err("should be Auth error");

    assert!(err.is_auth(), "expected Auth error, got {err:?}");
}

// ─── Rate Limit ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_rate_limit_returns_error_after_max_retries() {
    let mut server = Server::new_async().await;

    // Respond 429 for every request — SDK retries max_retries times then errors
    let _m = server
        .mock("GET", "/api/v1/agents/busy/kya")
        .with_status(429)
        .with_header("Retry-After", "1")
        .with_body(r#"{"error":"rate limited"}"#)
        .expect_at_least(1)
        .create_async()
        .await;

    let config = KyaClientConfig::builder()
        .base_url(format!("{}/api/v1", server.url()))
        .max_retries(0) // no retries so test doesn't wait
        .build();
    let client = KyaClient::new(config).unwrap();

    let err = client
        .get_kya_score("busy")
        .await
        .expect_err("should be RateLimit");

    assert!(err.is_rate_limit(), "expected RateLimit, got {err:?}");
    assert_eq!(err.retry_after_secs(), Some(1));
}

// ─── Badges ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_badges_ok() {
    let mut server = Server::new_async().await;

    let body = serde_json::json!([
        {
            "id": "b1",
            "badge_id": "bd1",
            "slug": "early-adopter",
            "name": "Early Adopter",
            "description": "Joined during beta",
            "icon_url": null,
            "voltage_reward": 100,
            "awarded_at": "2025-06-01T00:00:00Z"
        }
    ]);

    let _m = server
        .mock("GET", "/api/v1/agents/agent42/badges")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(body.to_string())
        .create_async()
        .await;

    let client = make_client(&server);
    let badges = client.get_badges("agent42").await.expect("should succeed");

    assert_eq!(badges.len(), 1);
    assert_eq!(badges[0].slug, "early-adopter");
    assert_eq!(badges[0].voltage_reward, 100);
}

#[tokio::test]
async fn test_get_badges_empty() {
    let mut server = Server::new_async().await;

    let _m = server
        .mock("GET", "/api/v1/agents/newbie/badges")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body("[]")
        .create_async()
        .await;

    let client = make_client(&server);
    let badges = client.get_badges("newbie").await.expect("should succeed");
    assert!(badges.is_empty());
}

// ─── Identity Card ────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_card_json_ok() {
    let mut server = Server::new_async().await;

    let body = serde_json::json!({
        "handle": "agent42",
        "display_name": "Agent Forty-Two",
        "bio": "An example agent",
        "trust_tier": 2,
        "reputation_score": 42.0,
        "tagline": "I am an agent",
        "accent_color": "#4A90E2",
        "flair_tags": ["builder", "pioneer"],
        "created_at": "2025-01-01T00:00:00Z"
    });

    let _m = server
        .mock("GET", "/api/v1/agents/agent42/card")
        .match_query(mockito::Matcher::UrlEncoded(
            "format".into(),
            "json".into(),
        ))
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(body.to_string())
        .create_async()
        .await;

    let client = make_client(&server);
    let card = client.get_card("agent42").await.expect("should succeed");

    assert_eq!(card.handle, "agent42");
    assert_eq!(card.display_name.as_deref(), Some("Agent Forty-Two"));
    assert_eq!(card.trust_tier, 2);
    assert_eq!(card.flair_tags, vec!["builder", "pioneer"]);
}

// ─── Voltage ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_voltage_ok() {
    let mut server = Server::new_async().await;

    let body = serde_json::json!({
        "agent_id": "a-uuid-here",
        "balance": 500,
        "lifetime_earned": 1200,
        "updated_at": "2026-06-01T00:00:00Z"
    });

    let _m = server
        .mock("GET", "/api/v1/agents/agent42/voltage")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(body.to_string())
        .create_async()
        .await;

    let client = make_client(&server);
    let v = client.get_voltage("agent42").await.expect("should succeed");

    assert_eq!(v.balance, 500);
    assert_eq!(v.lifetime_earned, 1200);
}

// ─── Discovery ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_get_discovery_ok() {
    let mut server = Server::new_async().await;

    let body = serde_json::json!({
        "version": "1.0",
        "api_base": "https://pheme.ca/api/v1",
        "name": "KYA Trust System",
        "description": "Know Your Agent — trust scoring for the Pheme network",
        "docs_url": "https://pheme.ca/docs/kya"
    });

    // Discovery is fetched from /.well-known/ on the server origin
    let _m = server
        .mock("GET", "/.well-known/kya.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(body.to_string())
        .create_async()
        .await;

    let client = make_client(&server);
    let d = client.get_discovery().await.expect("should succeed");

    assert_eq!(d.version.as_deref(), Some("1.0"));
    assert_eq!(d.name.as_deref(), Some("KYA Trust System"));
}

// ─── Config ───────────────────────────────────────────────────────────────────

#[test]
fn test_config_builder_defaults() {
    let config = KyaClientConfig::default();
    assert_eq!(config.base_url, "https://pheme.ca/api/v1");
    assert_eq!(config.timeout_secs, 30);
    assert_eq!(config.max_retries, 3);
    assert!(config.api_key.is_none());
    assert!(config.jwt.is_none());
}

#[test]
fn test_config_builder_custom() {
    let config = KyaClientConfig::builder()
        .base_url("https://staging.pheme.ca/api/v1")
        .api_key("phm_your_api_key_here")
        .timeout_secs(15)
        .max_retries(5)
        .build();

    assert_eq!(config.base_url, "https://staging.pheme.ca/api/v1");
    assert_eq!(config.api_key.as_deref(), Some("phm_your_api_key_here"));
    assert_eq!(config.timeout_secs, 15);
    assert_eq!(config.max_retries, 5);
}

#[test]
fn test_invalid_config_empty_base_url() {
    let config = KyaClientConfig::builder().base_url("").build();
    assert!(KyaClient::new(config).is_err());
}
