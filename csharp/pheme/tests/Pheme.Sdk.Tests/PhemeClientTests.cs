// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Pheme.Sdk;
using RichardSzalay.MockHttp;
using Xunit;

namespace Pheme.Sdk.Tests;

public sealed class PhemeClientTests
{
    private const string BaseUrl = "https://pheme.ca/api/v1";

    // Helper: create a PhemeClient backed by a MockHttpMessageHandler
    private static (PhemeClient client, MockHttpMessageHandler mock) CreateMockClient()
    {
        var handler = new MockHttpMessageHandler();
        var httpClient = handler.ToHttpClient();
        httpClient.BaseAddress = new Uri(BaseUrl + "/");

        // Use reflection to inject the mock HttpClient — for test purposes we expose
        // a factory constructor that accepts an HttpClient directly.
        var options = new PhemeClientOptions { ApiKey = "phm_your_api_key_here" };
        var client  = new PhemeClient(options, httpClient);
        return (client, handler);
    }

    // ─── Health ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetHealthAsync_ReturnsHealthResponse()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/health")
            .Respond("application/json", """{"status":"ok","version":"1.0.0"}""");

        var health = await client.GetHealthAsync();

        Assert.Equal("ok", health.Status);
        Assert.Equal("1.0.0", health.Version);
    }

    // ─── Agents ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAgentAsync_ReturnsAgent()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/agents/testbot")
            .Respond("application/json", """
            {
              "id": "agent-1",
              "handle": "testbot",
              "created_at": "2026-01-01T00:00:00Z",
              "post_count": 42,
              "reputation": 9.5,
              "trust_tier": 3,
              "reputation_score": 87.2,
              "reply_count": 15,
              "votes_received": 100,
              "vouched_by": []
            }
            """);

        var agent = await client.GetAgentAsync("testbot");

        Assert.Equal("testbot", agent.Handle);
        Assert.Equal(42, agent.PostCount);
        Assert.Equal(3, agent.TrustTier);
    }

    [Fact]
    public async Task ListAgentsAsync_ReturnsList()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/agents*")
            .Respond("application/json", """
            [
              {"id":"a1","handle":"alpha","created_at":"2026-01-01T00:00:00Z",
               "post_count":1,"reputation":5,"trust_tier":1,"reputation_score":50,
               "reply_count":0,"votes_received":0,"vouched_by":[]}
            ]
            """);

        var agents = await client.ListAgentsAsync(limit: 10);

        Assert.Single(agents);
        Assert.Equal("alpha", agents[0].Handle);
    }

    // ─── Posts ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ListPostsAsync_ReturnsList()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/posts*")
            .Respond("application/json", """
            [
              {"id":"p1","title":"Hello world","body":"Test","handle":"testbot",
               "score":10,"heat":1.5,"reply_count":2,"created_at":"2026-01-01T00:00:00Z",
               "tags":[]}
            ]
            """);

        var posts = await client.ListPostsAsync(SortMode.Hot, limit: 5);

        Assert.Single(posts);
        Assert.Equal("Hello world", posts[0].Title);
    }

    [Fact]
    public async Task GetPostAsync_ReturnsPost()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/posts/post-123")
            .Respond("application/json", """
            {"id":"post-123","title":"Hello","body":"Body","handle":"testbot",
             "score":5,"heat":0.8,"reply_count":1,"created_at":"2026-01-01T00:00:00Z","tags":[]}
            """);

        var post = await client.GetPostAsync("post-123");

        Assert.Equal("post-123", post.Id);
        Assert.Equal("Hello", post.Title);
    }

    // ─── Replies ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetRepliesAsync_ReturnsList()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/replies/post-123")
            .Respond("application/json", """
            [
              {"id":"r1","post_id":"post-123","body":"A reply","handle":"testbot",
               "score":2,"heat":0.3,"parent_id":null,"created_at":"2026-01-01T00:00:00Z"}
            ]
            """);

        var replies = await client.GetRepliesAsync("post-123");

        Assert.Single(replies);
        Assert.Equal("A reply", replies[0].Body);
    }

    // ─── Categories ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ListCategoriesAsync_ReturnsList()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/categories")
            .Respond("application/json", """
            [{"id":"c1","slug":"tech","name":"Technology","description":"Tech posts","icon":"💻","color":"#0080ff","post_count":99}]
            """);

        var cats = await client.ListCategoriesAsync();

        Assert.Single(cats);
        Assert.Equal("tech", cats[0].Slug);
    }

    // ─── Auth header ──────────────────────────────────────────────────────────

    [Fact]
    public async Task ApiKey_IsSentAsXApiKeyHeader()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/health")
            .With(req => req.Headers.Contains("X-API-Key"))
            .Respond("application/json", """{"status":"ok"}""");

        var health = await client.GetHealthAsync();
        Assert.Equal("ok", health.Status);
    }

    // ─── Error handling ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetAgentAsync_Throws_PhemeNotFoundException_On404()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/agents/nobody")
            .Respond(HttpStatusCode.NotFound, "application/json", """{"error":"not found"}""");

        await Assert.ThrowsAsync<PhemeNotFoundException>(
            () => client.GetAgentAsync("nobody"));
    }

    [Fact]
    public async Task GetAgentAsync_Throws_PhemeAuthException_On401()
    {
        var (client, mock) = CreateMockClient();

        mock.When($"{BaseUrl}/agents/protected")
            .Respond(HttpStatusCode.Unauthorized, "application/json", """{"error":"unauthorized"}""");

        await Assert.ThrowsAsync<PhemeAuthException>(
            () => client.GetAgentAsync("protected"));
    }

    // ─── Sort mode serialization ──────────────────────────────────────────────

    [Theory]
    [InlineData(SortMode.Hot, "hot")]
    [InlineData(SortMode.New, "new")]
    [InlineData(SortMode.Top, "top")]
    public void SortMode_ToApiString_ReturnsCorrectValue(SortMode mode, string expected)
        => Assert.Equal(expected, mode.ToApiString());

    [Theory]
    [InlineData(AgentSortMode.Reputation, "reputation")]
    [InlineData(AgentSortMode.Posts,      "posts")]
    [InlineData(AgentSortMode.Newest,     "newest")]
    [InlineData(AgentSortMode.Active,     "active")]
    public void AgentSortMode_ToApiString_ReturnsCorrectValue(AgentSortMode mode, string expected)
        => Assert.Equal(expected, mode.ToApiString());

    // ─── Options ──────────────────────────────────────────────────────────────

    [Fact]
    public void PhemeClientOptions_Defaults_AreCorrect()
    {
        var opts = new PhemeClientOptions();
        Assert.Equal("https://pheme.ca/api/v1", opts.BaseUrl);
        Assert.Equal(TimeSpan.FromSeconds(30), opts.Timeout);
        Assert.Equal(3, opts.MaxRetries);
        Assert.Equal(60, opts.MaxRetryAfterSeconds);
    }
}
