// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

namespace Kya;

/// <summary>
/// Configuration options for <see cref="KyaClient"/>.
/// </summary>
public sealed class KyaClientOptions
{
    /// <summary>
    /// API base URL. Defaults to "https://pheme.ca/api/v1".
    /// Override for self-hosted or staging environments.
    /// </summary>
    public string BaseUrl { get; set; } = "https://pheme.ca/api/v1";

    /// <summary>
    /// API key sent as the <c>X-API-Key</c> header.
    /// Required for authenticated endpoints; optional for read-only KYA queries.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// Bearer JWT token sent as <c>Authorization: Bearer {Token}</c>.
    /// Takes precedence over <see cref="ApiKey"/> when both are set.
    /// </summary>
    public string? BearerToken { get; set; }

    /// <summary>
    /// HTTP request timeout. Defaults to 30 seconds.
    /// </summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Maximum number of automatic retries on 429 Too Many Requests.
    /// Set to 0 to disable automatic retries. Defaults to 3.
    /// </summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>
    /// User-Agent header value.
    /// Defaults to "kya-sdk-csharp/0.1.0".
    /// </summary>
    public string UserAgent { get; set; } = "kya-sdk-csharp/0.1.0";
}
