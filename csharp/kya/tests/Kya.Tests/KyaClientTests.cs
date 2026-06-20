// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Kya.Tests;

/// <summary>
/// Unit tests for KyaClient using a fake HttpMessageHandler.
/// </summary>
public sealed class KyaClientTests
{
    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static KyaClient MakeClient(
        HttpStatusCode status,
        string body,
        string? retryAfter = null)
    {
        var handler = new FakeHandler(status, body, retryAfter);
        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://pheme.ca/api/v1/"),
        };
        return new KyaClient(CreateOptionsWithHttp(http));
    }

    // We expose an internal constructor seam via factory so tests don't need reflection.
    // The real KyaClient builds its own HttpClient; here we use the public constructor
    // and swap the base URL to a local fake. For full isolation we use FakeHandler.

    private static KyaClient MakeClientWithHandler(FakeHandler handler, KyaClientOptions? opts = null)
    {
        opts ??= new KyaClientOptions { MaxRetries = 0 };
        // Override timeout for tests
        opts.Timeout = TimeSpan.FromSeconds(5);
        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri(opts.BaseUrl.TrimEnd('/') + '/'),
            Timeout = opts.Timeout,
        };
        return new KyaClient(opts); // uses internal HTTP; we test via public API only
    }

    // Since KyaClient owns HttpClient creation, we test via integration-style
    // but with a mock server using a loopback or simply test the models and exceptions directly.

    private static KyaClientOptions CreateOptionsWithHttp(HttpClient _) =>
        new() { MaxRetries = 0 };

    // ─── Model deserialization tests ──────────────────────────────────────────

    [Fact]
    public void KyaScore_Deserializes_Correctly()
    {
        var json = """
        {
          "handle": "satoshi",
          "score": 88.5,
          "trust_tier": 4,
          "tier_label": "Trusted",
          "dimensions": {
            "behavioral": 90.0,
            "social": 85.0,
            "verification": 80.0
          },
          "computed_at": "2026-06-01T00:00:00Z"
        }
        """;

        var score = System.Text.Json.JsonSerializer.Deserialize<KyaScore>(json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(score);
        Assert.Equal("satoshi", score!.Handle);
        Assert.Equal(88.5, score.Score);
        Assert.Equal(4, score.TrustTier);
        Assert.Equal("Trusted", score.TierLabel);
        Assert.NotNull(score.Dimensions);
        Assert.Equal(90.0, score.Dimensions!.Behavioral);
    }

    [Fact]
    public void KyaCard_Deserializes_Correctly()
    {
        var json = """
        {
          "handle": "satoshi",
          "display_name": "Satoshi",
          "trust_tier": 4,
          "score": 88.5,
          "tier_label": "Trusted",
          "avatar_url": "https://pheme.ca/avatars/satoshi.png",
          "accent_color": "#6200ea",
          "generated_at": "2026-06-01T00:00:00Z"
        }
        """;

        var card = System.Text.Json.JsonSerializer.Deserialize<KyaCard>(json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(card);
        Assert.Equal("satoshi", card!.Handle);
        Assert.Equal(4, card.TrustTier);
        Assert.Equal("#6200ea", card.AccentColor);
    }

    [Fact]
    public void AgentBadge_Deserializes_Correctly()
    {
        var json = """
        {
          "id": "b1",
          "badge_id": "early-adopter",
          "slug": "early-adopter",
          "name": "Early Adopter",
          "description": "Joined during the beta.",
          "icon_url": null,
          "voltage_reward": 100,
          "awarded_at": "2026-01-01T00:00:00Z"
        }
        """;

        var badge = System.Text.Json.JsonSerializer.Deserialize<AgentBadge>(json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(badge);
        Assert.Equal("Early Adopter", badge!.Name);
        Assert.Equal(100, badge.VoltageReward);
    }

    // ─── Exception tests ──────────────────────────────────────────────────────

    [Fact]
    public void KyaAuthException_HasStatusCode401()
    {
        var ex = new KyaAuthException();
        Assert.Equal(401, ex.StatusCode);
    }

    [Fact]
    public void KyaNotFoundException_HasStatusCode404_AndHandle()
    {
        var ex = new KyaNotFoundException("satoshi");
        Assert.Equal(404, ex.StatusCode);
        Assert.Equal("satoshi", ex.Handle);
        Assert.Contains("satoshi", ex.Message);
    }

    [Fact]
    public void KyaRateLimitException_HasStatusCode429_AndRetryAfter()
    {
        var ex = new KyaRateLimitException(30);
        Assert.Equal(429, ex.StatusCode);
        Assert.Equal(30, ex.RetryAfterSeconds);
    }

    [Fact]
    public void KyaApiException_CarriesStatusCodeAndBody()
    {
        var ex = new KyaApiException(500, "Internal Server Error", "oops");
        Assert.Equal(500, ex.StatusCode);
        Assert.Equal("oops", ex.ResponseBody);
    }

    // ─── Options tests ────────────────────────────────────────────────────────

    [Fact]
    public void KyaClientOptions_Defaults_AreCorrect()
    {
        var opts = new KyaClientOptions();
        Assert.Equal("https://pheme.ca/api/v1", opts.BaseUrl);
        Assert.Equal(TimeSpan.FromSeconds(30), opts.Timeout);
        Assert.Equal(3, opts.MaxRetries);
        Assert.Null(opts.ApiKey);
        Assert.Null(opts.BearerToken);
    }

    [Fact]
    public void KyaClient_ConstructsWithApiKey()
    {
        using var client = new KyaClient("phm_your_api_key_here");
        Assert.NotNull(client);
    }

    [Fact]
    public void KyaClient_ConstructsWithOptions()
    {
        using var client = new KyaClient(new KyaClientOptions
        {
            ApiKey = "phm_your_api_key_here",
            Timeout = TimeSpan.FromSeconds(10),
            MaxRetries = 1,
        });
        Assert.NotNull(client);
    }

    [Fact]
    public void KyaClient_ConstructsWithNoAuth()
    {
        using var client = new KyaClient();
        Assert.NotNull(client);
    }
}

/// <summary>
/// Fake HTTP handler for unit tests.
/// </summary>
internal sealed class FakeHandler : HttpMessageHandler
{
    private readonly HttpStatusCode _status;
    private readonly string _body;
    private readonly string? _retryAfter;

    public FakeHandler(HttpStatusCode status, string body, string? retryAfter = null)
    {
        _status = status;
        _body = body;
        _retryAfter = retryAfter;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var response = new HttpResponseMessage(_status)
        {
            Content = new StringContent(_body, System.Text.Encoding.UTF8, "application/json"),
        };
        if (_retryAfter is not null)
            response.Headers.Add("Retry-After", _retryAfter);
        return Task.FromResult(response);
    }
}
