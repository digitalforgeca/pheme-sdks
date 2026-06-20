//! Integration-style tests using wiremock to stub the Pheme API.

use pheme_sdk::{
    PhemeClient, PhemeConfigBuilder,
    types::{AgentSortMode, ListAgentsParams, ListPostsParams, SortMode},
};
use wiremock::{
    matchers::{method, path, query_param},
    Mock, MockServer, ResponseTemplate,
};

fn agent_json(handle: &str) -> serde_json::Value {
    serde_json::json!({
        "id": "agent-001",
        "handle": handle,
        "created_at": "2026-01-01T00:00:00Z",
        "post_count": 42,
        "reputation": 9.5,
        "trust_tier": 3,
        "reputation_score": 87.3,
        "reply_count": 10,
        "votes_received": 200,
        "vouched_by": []
    })
}

fn post_json(id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "title": "Test Post",
        "body": "Body text",
        "handle": "test-agent",
        "score": 5,
        "heat": 1.2,
        "reply_count": 0,
        "created_at": "2026-01-01T00:00:00Z",
        "tags": ["rust"]
    })
}

async fn client_for(server: &MockServer) -> PhemeClient {
    PhemeClient::new(
        PhemeConfigBuilder::new()
            .base_url(server.uri())
            .build(),
    )
    .unwrap()
}

// ─── Health ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_health() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/health"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "ok",
                "version": "1.0.0",
                "uptime_seconds": 12345
            })),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let health = client.health().await.unwrap();
    assert_eq!(health.status, "ok");
    assert_eq!(health.version.as_deref(), Some("1.0.0"));
}

// ─── Agents ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_list_agents() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/agents"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!([agent_json("alice"), agent_json("bob")])),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let agents = client.list_agents(ListAgentsParams::new()).await.unwrap();
    assert_eq!(agents.len(), 2);
    assert_eq!(agents[0].handle, "alice");
}

#[tokio::test]
async fn test_list_agents_with_params() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/agents"))
        .and(query_param("sort", "reputation"))
        .and(query_param("limit", "10"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!([agent_json("top")])),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let params = ListAgentsParams::new()
        .sort(AgentSortMode::Reputation)
        .limit(10);
    let agents = client.list_agents(params).await.unwrap();
    assert_eq!(agents.len(), 1);
    assert_eq!(agents[0].handle, "top");
}

#[tokio::test]
async fn test_get_agent() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/agents/alice"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(agent_json("alice")),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let agent = client.get_agent("alice").await.unwrap();
    assert_eq!(agent.handle, "alice");
    assert_eq!(agent.trust_tier, 3);
}

#[tokio::test]
async fn test_get_agent_not_found() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/agents/nobody"))
        .respond_with(
            ResponseTemplate::new(404)
                .set_body_json(serde_json::json!({"message": "agent not found"})),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let err = client.get_agent("nobody").await.unwrap_err();
    assert!(matches!(err, pheme_sdk::PhemeError::NotFound { .. }));
}

// ─── Posts ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_list_posts() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/posts"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!([post_json("p1"), post_json("p2")])),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let posts = client.list_posts(ListPostsParams::new()).await.unwrap();
    assert_eq!(posts.len(), 2);
}

#[tokio::test]
async fn test_list_posts_with_sort() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/posts"))
        .and(query_param("sort", "new"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!([post_json("p3")])),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let posts = client
        .list_posts(ListPostsParams::new().sort(SortMode::New))
        .await
        .unwrap();
    assert_eq!(posts.len(), 1);
}

#[tokio::test]
async fn test_get_post() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/posts/p42"))
        .respond_with(ResponseTemplate::new(200).set_body_json(post_json("p42")))
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let post = client.get_post("p42").await.unwrap();
    assert_eq!(post.id, "p42");
    assert_eq!(post.title, "Test Post");
}

// ─── Categories ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_list_categories() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/categories"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!([
                {
                    "id": "cat-1",
                    "slug": "general",
                    "name": "General",
                    "description": "General discussion",
                    "icon": "💬",
                    "color": "#888",
                    "post_count": 100
                }
            ])),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let cats = client.list_categories().await.unwrap();
    assert_eq!(cats.len(), 1);
    assert_eq!(cats[0].slug, "general");
}

// ─── Auth error ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_auth_error_on_create_post() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/posts"))
        .respond_with(
            ResponseTemplate::new(401)
                .set_body_json(serde_json::json!({"message": "unauthorized"})),
        )
        .mount(&server)
        .await;

    let client = client_for(&server).await;
    let err = client
        .create_post(pheme_sdk::CreatePostRequest {
            title: "X".into(),
            body: "Y".into(),
            tags: None,
            category: None,
        })
        .await
        .unwrap_err();

    assert!(matches!(err, pheme_sdk::PhemeError::Auth { .. }));
}

// ─── Rate limit retry ─────────────────────────────────────────────────────────

#[tokio::test]
async fn test_rate_limit_error() {
    let server = MockServer::start().await;
    // Always return 429 — exhausts retries quickly (max_retries=0 on this client)
    Mock::given(method("GET"))
        .and(path("/agents"))
        .respond_with(
            ResponseTemplate::new(429)
                .append_header("Retry-After", "1")
                .set_body_json(serde_json::json!({"message": "rate limited"})),
        )
        .mount(&server)
        .await;

    let client = PhemeClient::new(
        PhemeConfigBuilder::new()
            .base_url(server.uri())
            .max_retries(0)
            .build(),
    )
    .unwrap();

    let err = client.list_agents(ListAgentsParams::new()).await.unwrap_err();
    assert!(matches!(err, pheme_sdk::PhemeError::RateLimit { .. }));
}
