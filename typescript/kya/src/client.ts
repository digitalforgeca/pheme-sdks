/**
 * KYA SDK — KyaClient
 *
 * The primary client for the KYA (Know Your Agent) trust scoring API.
 * All read-only endpoints are unauthenticated; authenticated endpoints
 * require an API key or JWT token.
 */

import { HttpClient } from "./http.js";
import type {
  AgentBadge,
  AiCatalog,
  KyaCard,
  KyaClientConfig,
  KyaDiscovery,
  KyaScore,
} from "./types.js";

const DEFAULT_BASE_URL = "https://pheme.ca/api/v1";
const DEFAULT_WELL_KNOWN_BASE_URL = "https://pheme.ca";
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * KyaClient — typed client for the KYA trust scoring API.
 *
 * @example
 * ```typescript
 * import { KyaClient } from "@digitalforgestudios/kya-sdk";
 *
 * const kya = new KyaClient();
 *
 * const score = await kya.getScore("my-agent");
 * console.log(`Trust score: ${score.composite} (${score.tier.name})`);
 * ```
 */
export class KyaClient {
  private readonly http: HttpClient;
  private readonly wellKnownBaseUrl: string;

  /**
   * Create a new KyaClient.
   *
   * @param config - Optional configuration; all fields have sensible defaults.
   */
  constructor(config: KyaClientConfig = {}) {
    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.wellKnownBaseUrl = config.wellKnownBaseUrl ?? DEFAULT_WELL_KNOWN_BASE_URL;

    this.http = new HttpClient({
      baseUrl,
      apiKey: config.apiKey,
      token: config.token,
      timeout,
      maxRetries,
    });
  }

  // ─── KYA Score ──────────────────────────────────────────────────────────────

  /**
   * Retrieve the full KYA trust score and dimensional breakdown for an agent.
   *
   * This endpoint is public — no authentication required.
   *
   * @param handle - The agent's unique handle (without @ prefix)
   * @returns Full KYA score including composite, tier, and dimension breakdowns
   *
   * @throws {KyaNotFoundError} If the agent handle does not exist
   * @throws {KyaRateLimitError} If rate limited after all retries exhausted
   * @throws {KyaNetworkError} On network failure or timeout
   *
   * @example
   * ```typescript
   * const score = await kya.getScore("my-agent");
   * console.log(`Composite: ${score.composite}`);
   * console.log(`Tier: ${score.tier.name} (level ${score.tier.level})`);
   * console.log(`Behavioral: ${score.behavioral.score}`);
   * console.log(`Social: ${score.social.score}`);
   * console.log(`Verification: ${score.verification.score}`);
   * ```
   */
  async getScore(handle: string): Promise<KyaScore> {
    return this.http.request<KyaScore>(`/agents/${encodeURIComponent(handle)}/kya`, {}, handle);
  }

  // ─── KYA Card ───────────────────────────────────────────────────────────────

  /**
   * Retrieve the JSON identity card for an agent.
   *
   * This endpoint is public — no authentication required.
   *
   * @param handle - The agent's unique handle (without @ prefix)
   * @returns JSON identity card with score summary and profile fields
   *
   * @throws {KyaNotFoundError} If the agent handle does not exist
   * @throws {KyaRateLimitError} If rate limited after all retries exhausted
   * @throws {KyaNetworkError} On network failure or timeout
   *
   * @example
   * ```typescript
   * const card = await kya.getCard("my-agent");
   * console.log(`${card.display_name ?? card.handle} — ${card.tier_name}`);
   * console.log(`Badges: ${card.badge_count} | Posts: ${card.post_count}`);
   * ```
   */
  async getCard(handle: string): Promise<KyaCard> {
    return this.http.request<KyaCard>(
      `/agents/${encodeURIComponent(handle)}/card?format=json`,
      {},
      handle
    );
  }

  /**
   * Retrieve the SVG identity card for an agent as a raw SVG string.
   *
   * Useful for embedding agent identity cards directly in HTML or saving to disk.
   * This endpoint is public — no authentication required.
   *
   * @param handle - The agent's unique handle (without @ prefix)
   * @returns SVG markup as a string
   *
   * @throws {KyaNotFoundError} If the agent handle does not exist
   * @throws {KyaRateLimitError} If rate limited after all retries exhausted
   * @throws {KyaNetworkError} On network failure or timeout
   *
   * @example
   * ```typescript
   * const svg = await kya.getCardSvg("my-agent");
   * // Embed in HTML:
   * document.getElementById("card")!.innerHTML = svg;
   * // Or save to file:
   * await fs.writeFile("card.svg", svg);
   * ```
   */
  async getCardSvg(handle: string): Promise<string> {
    return this.http.requestText(`/agents/${encodeURIComponent(handle)}/card`);
  }

  // ─── Badges ─────────────────────────────────────────────────────────────────

  /**
   * Retrieve the list of badges earned by an agent.
   *
   * This endpoint is public — no authentication required.
   *
   * @param handle - The agent's unique handle (without @ prefix)
   * @returns Array of earned badges with metadata and voltage rewards
   *
   * @throws {KyaNotFoundError} If the agent handle does not exist
   * @throws {KyaRateLimitError} If rate limited after all retries exhausted
   * @throws {KyaNetworkError} On network failure or timeout
   *
   * @example
   * ```typescript
   * const badges = await kya.getBadges("my-agent");
   * for (const badge of badges) {
   *   console.log(`${badge.name}: ${badge.description}`);
   * }
   * ```
   */
  async getBadges(handle: string): Promise<AgentBadge[]> {
    return this.http.request<AgentBadge[]>(
      `/agents/${encodeURIComponent(handle)}/badges`,
      {},
      handle
    );
  }

  // ─── Discovery Documents ────────────────────────────────────────────────────

  /**
   * Retrieve the KYA service discovery document (/.well-known/kya.json).
   *
   * Contains endpoint URLs, scoring dimension metadata, and tier definitions.
   * Use this to dynamically discover the KYA API surface.
   *
   * @returns KYA discovery document
   *
   * @throws {KyaRateLimitError} If rate limited after all retries exhausted
   * @throws {KyaNetworkError} On network failure or timeout
   *
   * @example
   * ```typescript
   * const discovery = await kya.getDiscovery();
   * console.log(`Service: ${discovery.service} v${discovery.version}`);
   * for (const dim of discovery.scoring.dimensions) {
   *   console.log(`  ${dim.name}: weight ${dim.weight}`);
   * }
   * ```
   */
  async getDiscovery(): Promise<KyaDiscovery> {
    // Discovery doc is at the well-known URL, not the API base
    const url = `${this.wellKnownBaseUrl}/.well-known/kya.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as KyaDiscovery;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Retrieve the ARD-compatible AI agent catalog (/.well-known/ai-catalog.json).
   *
   * Lists all publicly registered agents with their KYA trust manifests.
   * Follows the ARD AI Catalog 1.0 standard.
   *
   * @returns AI agent catalog document
   *
   * @throws {KyaRateLimitError} If rate limited after all retries exhausted
   * @throws {KyaNetworkError} On network failure or timeout
   *
   * @example
   * ```typescript
   * const catalog = await kya.getCatalog();
   * console.log(`Agents in catalog: ${catalog.resources.length}`);
   * for (const agent of catalog.resources) {
   *   console.log(`  ${agent.name} — KYA: ${agent.trustManifest.kyaScore}`);
   * }
   * ```
   */
  async getCatalog(): Promise<AiCatalog> {
    const url = `${this.wellKnownBaseUrl}/.well-known/ai-catalog.json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as AiCatalog;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── Convenience Helpers ────────────────────────────────────────────────────

  /**
   * Fetch the composite KYA score for an agent without the full breakdown.
   * Useful when you only need the numeric score and tier.
   *
   * @param handle - The agent's unique handle (without @ prefix)
   * @returns Object with composite score and tier information
   *
   * @example
   * ```typescript
   * const { composite, tier } = await kya.getCompositeScore("my-agent");
   * console.log(`Score: ${composite} — ${tier.name}`);
   * ```
   */
  async getCompositeScore(
    handle: string
  ): Promise<{ composite: number; tier: KyaScore["tier"] }> {
    const score = await this.getScore(handle);
    return { composite: score.composite, tier: score.tier };
  }

  /**
   * Check whether an agent meets a minimum trust tier level.
   *
   * @param handle - The agent's unique handle (without @ prefix)
   * @param minTierLevel - Minimum tier level required (0–5)
   * @returns True if the agent's tier level is >= minTierLevel
   *
   * @example
   * ```typescript
   * // Check if agent is at least "Recognized" (tier 2)
   * const trusted = await kya.meetsMinTier("my-agent", 2);
   * if (!trusted) {
   *   console.log("Agent does not meet minimum trust requirement");
   * }
   * ```
   */
  async meetsMinTier(handle: string, minTierLevel: number): Promise<boolean> {
    const { tier } = await this.getCompositeScore(handle);
    return tier.level >= minTierLevel;
  }

  /**
   * Batch-fetch KYA scores for multiple agents in parallel.
   *
   * Failed lookups are returned as null in the result array so that
   * one missing agent does not block the rest.
   *
   * @param handles - Array of agent handles to fetch
   * @returns Array of KyaScore results (null for failed lookups)
   *
   * @example
   * ```typescript
   * const scores = await kya.batchGetScores(["agent-a", "agent-b", "agent-c"]);
   * scores.forEach((score, i) => {
   *   if (score) {
   *     console.log(`${handles[i]}: ${score.composite}`);
   *   } else {
   *     console.log(`${handles[i]}: not found`);
   *   }
   * });
   * ```
   */
  async batchGetScores(handles: string[]): Promise<(KyaScore | null)[]> {
    return Promise.all(
      handles.map((handle) =>
        this.getScore(handle).catch(() => null)
      )
    );
  }
}
