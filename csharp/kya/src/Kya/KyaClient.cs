// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace Kya;

/// <summary>
/// HTTP client for the KYA agent trust scoring API.
/// </summary>
/// <example>
/// <code>
/// using var client = new KyaClient(new KyaClientOptions { ApiKey = "phm_your_api_key_here" });
/// var score = await client.GetScoreAsync("satoshi");
/// Console.WriteLine($"Trust tier: {score.TrustTier} | Score: {score.Score}");
/// </code>
/// </example>
public sealed class KyaClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly KyaClientOptions _options;
    private bool _disposed;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // ─── Construction ────────────────────────────────────────────────────────

    /// <summary>
    /// Initialises the client with the supplied options.
    /// </summary>
    public KyaClient(KyaClientOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _http = BuildHttpClient(options);
    }

    /// <summary>
    /// Initialises the client with an optional API key and default options.
    /// </summary>
    /// <param name="apiKey">
    /// Your KYA API key (e.g. <c>phm_your_api_key_here</c>).
    /// Leave null for unauthenticated read-only access.
    /// </param>
    public KyaClient(string? apiKey = null)
        : this(new KyaClientOptions { ApiKey = apiKey }) { }

    private static HttpClient BuildHttpClient(KyaClientOptions opts)
    {
        var baseUrl = opts.BaseUrl.TrimEnd('/') + '/';
        var http = new HttpClient
        {
            BaseAddress = new Uri(baseUrl),
            Timeout = opts.Timeout,
        };
        http.DefaultRequestHeaders.Add("User-Agent", opts.UserAgent);

        if (opts.BearerToken is not null)
        {
            http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", opts.BearerToken);
        }
        else if (opts.ApiKey is not null)
        {
            http.DefaultRequestHeaders.Add("X-API-Key", opts.ApiKey);
        }

        return http;
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /// <summary>
    /// Retrieves the KYA trust score and dimensional breakdown for an agent.
    /// </summary>
    /// <param name="handle">Agent handle (with or without the leading "@").</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The agent's <see cref="KyaScore"/>.</returns>
    /// <exception cref="KyaNotFoundException">The agent does not exist.</exception>
    /// <exception cref="KyaRateLimitException">Request was rate-limited.</exception>
    /// <exception cref="KyaApiException">Any other non-success API response.</exception>
    public Task<KyaScore> GetScoreAsync(string handle, CancellationToken ct = default)
        => GetAsync<KyaScore>($"agents/{NormalizeHandle(handle)}/kya", ct);

    /// <summary>
    /// Retrieves the JSON representation of an agent's KYA identity card.
    /// </summary>
    /// <param name="handle">Agent handle.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The agent's <see cref="KyaCard"/>.</returns>
    public Task<KyaCard> GetCardAsync(string handle, CancellationToken ct = default)
        => GetAsync<KyaCard>($"agents/{NormalizeHandle(handle)}/card?format=json", ct);

    /// <summary>
    /// Retrieves the SVG identity card for an agent as a raw string.
    /// </summary>
    /// <param name="handle">Agent handle.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>SVG document string.</returns>
    public async Task<string> GetCardSvgAsync(string handle, CancellationToken ct = default)
    {
        var path = $"agents/{NormalizeHandle(handle)}/card";
        using var response = await SendWithRetryAsync(path, ct).ConfigureAwait(false);
        return await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Retrieves all badges earned by an agent.
    /// </summary>
    /// <param name="handle">Agent handle.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>List of <see cref="AgentBadge"/>.</returns>
    public async Task<List<AgentBadge>> GetBadgesAsync(string handle, CancellationToken ct = default)
    {
        var path = $"agents/{NormalizeHandle(handle)}/badges";
        // Response may be wrapped or a bare array — handle both shapes.
        using var doc = await GetJsonDocumentAsync(path, ct).ConfigureAwait(false);
        var root = doc.RootElement;

        if (root.ValueKind == JsonValueKind.Array)
        {
            return root.Deserialize<List<AgentBadge>>(JsonOpts) ?? [];
        }

        // Try common wrapper keys
        foreach (var key in new[] { "badges", "data", "items" })
        {
            if (root.TryGetProperty(key, out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                return arr.Deserialize<List<AgentBadge>>(JsonOpts) ?? [];
            }
        }

        return root.Deserialize<List<AgentBadge>>(JsonOpts) ?? [];
    }

    /// <summary>
    /// Fetches the KYA discovery document (<c>/.well-known/kya.json</c>).
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The <see cref="KyaDiscoveryDocument"/>.</returns>
    public Task<KyaDiscoveryDocument> GetDiscoveryDocumentAsync(CancellationToken ct = default)
        => GetAbsoluteAsync<KyaDiscoveryDocument>("/.well-known/kya.json", ct);

    /// <summary>
    /// Fetches the ARD-compatible agent catalog (<c>/.well-known/ai-catalog.json</c>).
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The <see cref="AgentCatalog"/>.</returns>
    public async Task<AgentCatalog> GetAgentCatalogAsync(CancellationToken ct = default)
    {
        var raw = await GetAbsoluteRawAsync("/.well-known/ai-catalog.json", ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        // Catalog may be a bare array or wrapped {"agents":[...]}
        if (root.ValueKind == JsonValueKind.Array)
        {
            var entries = root.Deserialize<List<AgentCatalogEntry>>(JsonOpts) ?? [];
            return new AgentCatalog { Agents = entries };
        }

        return root.Deserialize<AgentCatalog>(JsonOpts)
            ?? new AgentCatalog { Agents = [] };
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private async Task<T> GetAsync<T>(string path, CancellationToken ct)
    {
        using var doc = await GetJsonDocumentAsync(path, ct).ConfigureAwait(false);
        return doc.RootElement.Deserialize<T>(JsonOpts)
               ?? throw new KyaApiException(200, "Empty or null response body");
    }

    private async Task<T> GetAbsoluteAsync<T>(string absolutePath, CancellationToken ct)
    {
        var raw = await GetAbsoluteRawAsync(absolutePath, ct).ConfigureAwait(false);
        return JsonSerializer.Deserialize<T>(raw, JsonOpts)
               ?? throw new KyaApiException(200, "Empty or null response body");
    }

    private async Task<string> GetAbsoluteRawAsync(string absolutePath, CancellationToken ct)
    {
        // Build URL relative to the host (not the API base path)
        var host = new Uri(_http.BaseAddress!, "/");
        var url = new Uri(host, absolutePath);

        int attempt = 0;
        while (true)
        {
            attempt++;
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            HttpResponseMessage resp;
            try
            {
                resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw new KyaException($"Network error: {ex.Message}", inner: ex);
            }

            using (resp)
            {
                if (resp.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    var wait = ParseRetryAfter(resp) ?? 5;
                    if (attempt <= _options.MaxRetries)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(wait), ct).ConfigureAwait(false);
                        continue;
                    }
                    throw new KyaRateLimitException(wait);
                }

                await EnsureSuccessAsync(resp, null, ct).ConfigureAwait(false);
                return await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            }
        }
    }

    private async Task<JsonDocument> GetJsonDocumentAsync(string path, CancellationToken ct)
    {
        using var response = await SendWithRetryAsync(path, ct).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        return JsonDocument.Parse(body);
    }

    private async Task<HttpResponseMessage> SendWithRetryAsync(string path, CancellationToken ct)
    {
        int attempt = 0;
        while (true)
        {
            attempt++;
            HttpResponseMessage resp;
            try
            {
                resp = await _http.GetAsync(path, ct).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                throw new KyaException($"Network error: {ex.Message}", inner: ex);
            }

            if (resp.StatusCode == HttpStatusCode.TooManyRequests)
            {
                var wait = ParseRetryAfter(resp) ?? 5;
                resp.Dispose();
                if (attempt <= _options.MaxRetries)
                {
                    await Task.Delay(TimeSpan.FromSeconds(wait), ct).ConfigureAwait(false);
                    continue;
                }
                throw new KyaRateLimitException(wait);
            }

            string? handleHint = null;
            if (path.StartsWith("agents/", StringComparison.OrdinalIgnoreCase))
            {
                handleHint = path.Split('/').ElementAtOrDefault(1);
            }

            await EnsureSuccessAsync(resp, handleHint, ct).ConfigureAwait(false);
            return resp;
        }
    }

    private static async Task EnsureSuccessAsync(
        HttpResponseMessage resp,
        string? handleHint,
        CancellationToken ct)
    {
        if (resp.IsSuccessStatusCode) return;

        var body = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

        switch ((int)resp.StatusCode)
        {
            case 401:
                throw new KyaAuthException(body);
            case 404:
                throw new KyaNotFoundException(handleHint, body);
            default:
                throw new KyaApiException((int)resp.StatusCode, resp.ReasonPhrase ?? "Error", body);
        }
    }

    private static int? ParseRetryAfter(HttpResponseMessage resp)
    {
        if (resp.Headers.TryGetValues("Retry-After", out var values))
        {
            var val = values.FirstOrDefault();
            if (int.TryParse(val, out var secs)) return secs;
        }
        return null;
    }

    private static string NormalizeHandle(string handle)
        => handle.TrimStart('@').ToLowerInvariant();

    // ─── IDisposable ─────────────────────────────────────────────────────────

    public void Dispose()
    {
        if (!_disposed)
        {
            _http.Dispose();
            _disposed = true;
        }
    }
}
