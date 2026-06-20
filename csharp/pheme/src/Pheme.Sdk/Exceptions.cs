// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

namespace Pheme.Sdk;

/// <summary>Base exception for all Pheme API errors.</summary>
public class PhemeApiException : Exception
{
    /// <summary>HTTP status code returned by the server.</summary>
    public int StatusCode { get; }

    /// <summary>Raw response body, if available.</summary>
    public string? ResponseBody { get; }

    public PhemeApiException(int statusCode, string message, string? responseBody = null)
        : base(message)
    {
        StatusCode = statusCode;
        ResponseBody = responseBody;
    }
}

/// <summary>Thrown when the server returns HTTP 401 Unauthorized.</summary>
public sealed class PhemeAuthException : PhemeApiException
{
    public PhemeAuthException(string? responseBody = null)
        : base(401, "Authentication failed — check your API key or JWT.", responseBody) { }
}

/// <summary>Thrown when the server returns HTTP 403 Forbidden.</summary>
public sealed class PhemeForbiddenException : PhemeApiException
{
    public PhemeForbiddenException(string? responseBody = null)
        : base(403, "Access denied.", responseBody) { }
}

/// <summary>Thrown when the server returns HTTP 404 Not Found.</summary>
public sealed class PhemeNotFoundException : PhemeApiException
{
    public PhemeNotFoundException(string resource, string? responseBody = null)
        : base(404, $"Resource not found: {resource}", responseBody) { }
}

/// <summary>Thrown when the server returns HTTP 429 Too Many Requests.</summary>
public sealed class PhemeRateLimitException : PhemeApiException
{
    /// <summary>Seconds to wait before retrying, if the server supplied a Retry-After header.</summary>
    public int? RetryAfterSeconds { get; }

    public PhemeRateLimitException(int? retryAfterSeconds = null, string? responseBody = null)
        : base(429, $"Rate limit exceeded. Retry after {retryAfterSeconds?.ToString() ?? "unknown"} seconds.", responseBody)
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}

/// <summary>Thrown for unexpected server errors (5xx).</summary>
public sealed class PhemeServerException : PhemeApiException
{
    public PhemeServerException(int statusCode, string? responseBody = null)
        : base(statusCode, $"Server error: HTTP {statusCode}", responseBody) { }
}

/// <summary>Thrown when the HTTP request cannot be completed (network failure, timeout, etc.).</summary>
public sealed class PhemeNetworkException : Exception
{
    public PhemeNetworkException(string message, Exception? inner = null)
        : base(message, inner) { }
}
