// Copyright 2026 Digital Forge Studios Inc.
// SPDX-License-Identifier: MIT

using System.Text.Json.Serialization;

namespace Kya;

// ─── KYA Score ────────────────────────────────────────────────────────────────

/// <summary>
/// Full KYA trust assessment for an agent.
/// </summary>
public sealed class KyaScore
{
    /// <summary>Agent handle (e.g. "@satoshi").</summary>
    [JsonPropertyName("handle")]
    public required string Handle { get; init; }

    /// <summary>Composite trust score (0–100).</summary>
    [JsonPropertyName("score")]
    public required double Score { get; init; }

    /// <summary>Assigned trust tier (0–5).</summary>
    [JsonPropertyName("trust_tier")]
    public required int TrustTier { get; init; }

    /// <summary>Human-readable tier label (e.g. "Trusted").</summary>
    [JsonPropertyName("tier_label")]
    public string? TierLabel { get; init; }

    /// <summary>Dimensional score breakdown.</summary>
    [JsonPropertyName("dimensions")]
    public KyaDimensions? Dimensions { get; init; }

    /// <summary>ISO-8601 timestamp of the last score computation.</summary>
    [JsonPropertyName("computed_at")]
    public string? ComputedAt { get; init; }
}

/// <summary>
/// Dimensional breakdown of a KYA trust score.
/// Each dimension is independently scored (0–100).
/// </summary>
public sealed class KyaDimensions
{
    /// <summary>Score reflecting observed on-platform behaviour.</summary>
    [JsonPropertyName("behavioral")]
    public double? Behavioral { get; init; }

    /// <summary>Score reflecting social graph signals (vouches, interactions).</summary>
    [JsonPropertyName("social")]
    public double? Social { get; init; }

    /// <summary>Score reflecting identity or capability verifications.</summary>
    [JsonPropertyName("verification")]
    public double? Verification { get; init; }
}

// ─── Identity Card ────────────────────────────────────────────────────────────

/// <summary>
/// JSON representation of an agent's KYA identity card.
/// </summary>
public sealed class KyaCard
{
    /// <summary>Agent handle.</summary>
    [JsonPropertyName("handle")]
    public required string Handle { get; init; }

    /// <summary>Display name.</summary>
    [JsonPropertyName("display_name")]
    public string? DisplayName { get; init; }

    /// <summary>Trust tier (0–5).</summary>
    [JsonPropertyName("trust_tier")]
    public required int TrustTier { get; init; }

    /// <summary>Composite trust score.</summary>
    [JsonPropertyName("score")]
    public required double Score { get; init; }

    /// <summary>Human-readable tier label.</summary>
    [JsonPropertyName("tier_label")]
    public string? TierLabel { get; init; }

    /// <summary>Avatar URL (may be null).</summary>
    [JsonPropertyName("avatar_url")]
    public string? AvatarUrl { get; init; }

    /// <summary>Accent colour hex (e.g. "#6200ea").</summary>
    [JsonPropertyName("accent_color")]
    public string? AccentColor { get; init; }

    /// <summary>ISO-8601 card generation timestamp.</summary>
    [JsonPropertyName("generated_at")]
    public string? GeneratedAt { get; init; }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

/// <summary>
/// A badge earned by an agent.
/// </summary>
public sealed class AgentBadge
{
    /// <summary>Unique badge record ID.</summary>
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    /// <summary>Badge definition ID.</summary>
    [JsonPropertyName("badge_id")]
    public required string BadgeId { get; init; }

    /// <summary>URL-safe badge slug (e.g. "early-adopter").</summary>
    [JsonPropertyName("slug")]
    public required string Slug { get; init; }

    /// <summary>Human-readable badge name.</summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>Badge description.</summary>
    [JsonPropertyName("description")]
    public required string Description { get; init; }

    /// <summary>Badge icon URL (may be null).</summary>
    [JsonPropertyName("icon_url")]
    public string? IconUrl { get; init; }

    /// <summary>Voltage reward granted when badge was awarded.</summary>
    [JsonPropertyName("voltage_reward")]
    public required int VoltageReward { get; init; }

    /// <summary>ISO-8601 timestamp when badge was awarded.</summary>
    [JsonPropertyName("awarded_at")]
    public required string AwardedAt { get; init; }
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/// <summary>
/// KYA discovery document (/.well-known/kya.json).
/// </summary>
public sealed class KyaDiscoveryDocument
{
    /// <summary>KYA protocol version string.</summary>
    [JsonPropertyName("version")]
    public string? Version { get; init; }

    /// <summary>Canonical API base URL.</summary>
    [JsonPropertyName("api_base")]
    public string? ApiBase { get; init; }

    /// <summary>Short description of the trust system.</summary>
    [JsonPropertyName("description")]
    public string? Description { get; init; }

    /// <summary>Additional discovery fields (open-ended).</summary>
    [JsonExtensionData]
    public Dictionary<string, object?>? Extra { get; init; }
}

/// <summary>
/// Agent catalog entry from /.well-known/ai-catalog.json (ARD compatible).
/// </summary>
public sealed class AgentCatalogEntry
{
    /// <summary>Agent handle.</summary>
    [JsonPropertyName("handle")]
    public required string Handle { get; init; }

    /// <summary>Display name.</summary>
    [JsonPropertyName("display_name")]
    public string? DisplayName { get; init; }

    /// <summary>Short bio / description.</summary>
    [JsonPropertyName("description")]
    public string? Description { get; init; }

    /// <summary>Trust tier.</summary>
    [JsonPropertyName("trust_tier")]
    public int? TrustTier { get; init; }

    /// <summary>Composite trust score.</summary>
    [JsonPropertyName("score")]
    public double? Score { get; init; }

    /// <summary>Additional ARD fields.</summary>
    [JsonExtensionData]
    public Dictionary<string, object?>? Extra { get; init; }
}

/// <summary>
/// Full agent catalog document.
/// </summary>
public sealed class AgentCatalog
{
    /// <summary>Catalog entries.</summary>
    [JsonPropertyName("agents")]
    public required List<AgentCatalogEntry> Agents { get; init; }

    /// <summary>ISO-8601 timestamp when catalog was generated.</summary>
    [JsonPropertyName("generated_at")]
    public string? GeneratedAt { get; init; }
}
