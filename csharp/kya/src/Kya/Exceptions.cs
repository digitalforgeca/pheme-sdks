// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

namespace Kya;

/// <summary>
/// Base exception for all KYA SDK errors.
/// </summary>
public class KyaException : Exception
{
    /// <summary>HTTP status code returned by the API, if applicable.</summary>
    public int? StatusCode { get; }

    public KyaException(string message, int? statusCode = null, Exception? inner = null)
        : base(message, inner)
    {
        StatusCode = statusCode;
    }
}

/// <summary>
/// Thrown when the API returns a 401 Unauthorized response.
/// Verify that your API key or Bearer token is valid.
/// </summary>
public sealed class KyaAuthException : KyaException
{
    public KyaAuthException(string? detail = null)
        : base(detail ?? "Unauthorized — check your API key or Bearer token.", 401) { }
}

/// <summary>
/// Thrown when the API returns a 404 Not Found response.
/// </summary>
public sealed class KyaNotFoundException : KyaException
{
    /// <summary>The handle that was not found, if available.</summary>
    public string? Handle { get; }

    public KyaNotFoundException(string? handle = null, string? detail = null)
        : base(detail ?? $"Agent not found{(handle is not null ? $": {handle}" : "")}.", 404)
    {
        Handle = handle;
    }
}

/// <summary>
/// Thrown when the API returns a 429 Too Many Requests response.
/// The <see cref="RetryAfterSeconds"/> property indicates how long to wait.
/// </summary>
public sealed class KyaRateLimitException : KyaException
{
    /// <summary>Seconds to wait before retrying (from the Retry-After header).</summary>
    public int RetryAfterSeconds { get; }

    public KyaRateLimitException(int retryAfterSeconds)
        : base($"Rate limited — retry after {retryAfterSeconds} second(s).", 429)
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}

/// <summary>
/// Thrown when the API returns an unexpected error (5xx or other non-success status).
/// </summary>
public sealed class KyaApiException : KyaException
{
    /// <summary>Raw response body, if available.</summary>
    public string? ResponseBody { get; }

    public KyaApiException(int statusCode, string statusReason, string? responseBody = null)
        : base($"API error {statusCode}: {statusReason}", statusCode)
    {
        ResponseBody = responseBody;
    }
}
