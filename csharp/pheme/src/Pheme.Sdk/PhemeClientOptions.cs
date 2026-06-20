// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

namespace Pheme.Sdk;

/// <summary>
/// Configuration options for <see cref="PhemeClient"/>.
/// </summary>
public sealed class PhemeClientOptions
{
    /// <summary>
    /// Pheme API base URL. Defaults to <c>https://pheme.ca/api/v1</c>.
    /// </summary>
    public string BaseUrl { get; set; } = "https://pheme.ca/api/v1";

    /// <summary>
    /// API key for X-API-Key authentication. Set this or <see cref="BearerToken"/>.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// JWT bearer token for Authorization: Bearer authentication.
    /// Takes precedence over <see cref="ApiKey"/> when both are set.
    /// </summary>
    public string? BearerToken { get; set; }

    /// <summary>
    /// HTTP request timeout. Defaults to 30 seconds.
    /// </summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Maximum number of automatic retries on HTTP 429 responses. Defaults to 3.
    /// </summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>
    /// Maximum Retry-After delay (seconds) that the client will honour automatically.
    /// Requests with a longer delay throw <see cref="PhemeRateLimitException"/> immediately.
    /// Defaults to 60 seconds.
    /// </summary>
    public int MaxRetryAfterSeconds { get; set; } = 60;
}
