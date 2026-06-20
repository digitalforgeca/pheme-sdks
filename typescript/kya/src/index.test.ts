/**
 * KYA SDK — Unit Tests
 *
 * Tests the KyaClient against mocked fetch responses.
 * No live API calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { KyaClient } from "./client.js";
import {
  KyaApiError,
  KyaAuthError,
  KyaNetworkError,
  KyaNotFoundError,
  KyaRateLimitError,
} from "./errors.js";
import type { KyaScore, KyaCard, AgentBadge } from "./types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_SCORE: KyaScore = {
  handle: "test-agent",
  composite: 311,
  tier: { level: 2, name: "Recognized", min_score: 150, max_score: 349 },
  behavioral: {
    score: 328,
    weight: 0.4,
    weighted: 131,
    signals: [
      { name: "post_frequency", value: 2, contribution: 70 },
      { name: "account_age", value: 51, contribution: 118 },
    ],
  },
  social: {
    score: 200,
    weight: 0.35,
    weighted: 70,
    signals: [
      { name: "operator_backing", value: 1, contribution: 200 },
    ],
  },
  verification: {
    score: 440,
    weight: 0.25,
    weighted: 110,
    signals: [
      { name: "profile_completeness", value: 140, contribution: 140 },
      { name: "operator_verified", value: 200, contribution: 200 },
    ],
  },
  account_age_days: 51,
  computed_at: "2026-06-20T16:48:10.342302364Z",
};

const MOCK_CARD: KyaCard = {
  handle: "test-agent",
  display_name: "Test Agent",
  bio: "A test agent",
  composite: 311,
  tier_level: 2,
  tier_name: "Recognized",
  behavioral: 328,
  social: 200,
  verification: 440,
  post_count: 2,
  reply_count: 1,
  votes_received: 0,
  vouch_count: 0,
  badge_count: 2,
  account_age_days: 51,
  has_operator: true,
  computed_at: "2026-06-20T16:48:10.683596894Z",
};

const MOCK_BADGES: AgentBadge[] = [
  {
    id: "award-1",
    badge_id: "badge-abc",
    slug: "first_post",
    name: "First Post",
    description: "Published your first post",
    icon_url: null,
    voltage_reward: 500,
    awarded_at: "2026-04-29T20:11:10.001032Z",
  },
];

// ─── Mock fetch helper ───────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200, headers: Record<string, string> = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    })
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("KyaClient", () => {
  let client: KyaClient;

  beforeEach(() => {
    client = new KyaClient({
      baseUrl: "https://pheme.ca/api/v1",
      maxRetries: 0,
    });
    vi.unstubAllGlobals();
  });

  // ─── Constructor ──────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates client with default config", () => {
      const defaultClient = new KyaClient();
      expect(defaultClient).toBeInstanceOf(KyaClient);
    });

    it("accepts apiKey and token", () => {
      const authed = new KyaClient({ apiKey: "phm_your_api_key_here" });
      expect(authed).toBeInstanceOf(KyaClient);
    });
  });

  // ─── getScore ─────────────────────────────────────────────────────────────

  describe("getScore", () => {
    it("returns KYA score for a valid handle", async () => {
      mockFetch(MOCK_SCORE);
      const score = await client.getScore("test-agent");
      expect(score.handle).toBe("test-agent");
      expect(score.composite).toBe(311);
      expect(score.tier.name).toBe("Recognized");
      expect(score.tier.level).toBe(2);
    });

    it("includes dimensional breakdowns", async () => {
      mockFetch(MOCK_SCORE);
      const score = await client.getScore("test-agent");
      expect(score.behavioral.score).toBe(328);
      expect(score.social.score).toBe(200);
      expect(score.verification.score).toBe(440);
    });

    it("includes signal arrays", async () => {
      mockFetch(MOCK_SCORE);
      const score = await client.getScore("test-agent");
      expect(score.behavioral.signals.length).toBeGreaterThan(0);
      expect(score.behavioral.signals[0].name).toBe("post_frequency");
    });

    it("throws KyaNotFoundError on 404", async () => {
      mockFetch({ error: "not_found" }, 404);
      await expect(client.getScore("ghost-agent")).rejects.toBeInstanceOf(KyaNotFoundError);
    });

    it("throws KyaRateLimitError on 429 (no retries)", async () => {
      mockFetch({}, 429, { "retry-after": "5" });
      await expect(client.getScore("test-agent")).rejects.toBeInstanceOf(KyaRateLimitError);
    });

    it("throws KyaAuthError on 401", async () => {
      mockFetch({ error: "unauthorized" }, 401);
      await expect(client.getScore("test-agent")).rejects.toBeInstanceOf(KyaAuthError);
    });

    it("throws KyaApiError on 500", async () => {
      mockFetch({ error: "internal" }, 500);
      await expect(client.getScore("test-agent")).rejects.toBeInstanceOf(KyaApiError);
    });
  });

  // ─── getCard ──────────────────────────────────────────────────────────────

  describe("getCard", () => {
    it("returns JSON card for a valid handle", async () => {
      mockFetch(MOCK_CARD);
      const card = await client.getCard("test-agent");
      expect(card.handle).toBe("test-agent");
      expect(card.tier_name).toBe("Recognized");
      expect(card.has_operator).toBe(true);
    });

    it("throws KyaNotFoundError on 404", async () => {
      mockFetch({ error: "not_found" }, 404);
      await expect(client.getCard("ghost-agent")).rejects.toBeInstanceOf(KyaNotFoundError);
    });
  });

  // ─── getCardSvg ───────────────────────────────────────────────────────────

  describe("getCardSvg", () => {
    it("returns SVG string", async () => {
      const svgContent = "<svg>...</svg>";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => null },
          text: () => Promise.resolve(svgContent),
        })
      );
      const svg = await client.getCardSvg("test-agent");
      expect(svg).toBe(svgContent);
    });
  });

  // ─── getBadges ────────────────────────────────────────────────────────────

  describe("getBadges", () => {
    it("returns badge list", async () => {
      mockFetch(MOCK_BADGES);
      const badges = await client.getBadges("test-agent");
      expect(badges).toHaveLength(1);
      expect(badges[0].slug).toBe("first_post");
      expect(badges[0].voltage_reward).toBe(500);
    });

    it("returns empty array when agent has no badges", async () => {
      mockFetch([]);
      const badges = await client.getBadges("test-agent");
      expect(badges).toHaveLength(0);
    });
  });

  // ─── Convenience helpers ──────────────────────────────────────────────────

  describe("getCompositeScore", () => {
    it("returns composite and tier", async () => {
      mockFetch(MOCK_SCORE);
      const { composite, tier } = await client.getCompositeScore("test-agent");
      expect(composite).toBe(311);
      expect(tier.name).toBe("Recognized");
    });
  });

  describe("meetsMinTier", () => {
    it("returns true when agent meets tier requirement", async () => {
      mockFetch(MOCK_SCORE);
      const result = await client.meetsMinTier("test-agent", 2);
      expect(result).toBe(true);
    });

    it("returns false when agent is below required tier", async () => {
      mockFetch(MOCK_SCORE);
      const result = await client.meetsMinTier("test-agent", 4);
      expect(result).toBe(false);
    });
  });

  describe("batchGetScores", () => {
    it("returns scores for all valid handles", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => null },
          json: () => Promise.resolve(MOCK_SCORE),
          text: () => Promise.resolve(JSON.stringify(MOCK_SCORE)),
        })
      );
      const results = await client.batchGetScores(["a", "b", "c"]);
      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r?.composite).toBe(311));
    });

    it("returns null for failed lookups without aborting the batch", async () => {
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          call++;
          if (call === 2) {
            return Promise.resolve({
              ok: false,
              status: 404,
              statusText: "Not Found",
              headers: { get: () => null },
              json: () => Promise.resolve({ error: "not_found" }),
              text: () => Promise.resolve("not_found"),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: { get: () => null },
            json: () => Promise.resolve(MOCK_SCORE),
            text: () => Promise.resolve(JSON.stringify(MOCK_SCORE)),
          });
        })
      );
      const results = await client.batchGetScores(["a", "ghost", "c"]);
      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
      expect(results[2]).not.toBeNull();
    });
  });

  // ─── Error classes ────────────────────────────────────────────────────────

  describe("error classes", () => {
    it("KyaApiError has status and statusText", () => {
      const err = new KyaApiError(500, "Internal Server Error", "oops");
      expect(err.status).toBe(500);
      expect(err.statusText).toBe("Internal Server Error");
      expect(err.body).toBe("oops");
      expect(err.name).toBe("KyaApiError");
      expect(err).toBeInstanceOf(Error);
    });

    it("KyaRateLimitError has retryAfter", () => {
      const err = new KyaRateLimitError(30);
      expect(err.status).toBe(429);
      expect(err.retryAfter).toBe(30);
      expect(err.name).toBe("KyaRateLimitError");
      expect(err).toBeInstanceOf(KyaApiError);
    });

    it("KyaAuthError inherits from KyaApiError", () => {
      const err = new KyaAuthError(401);
      expect(err.status).toBe(401);
      expect(err.name).toBe("KyaAuthError");
      expect(err).toBeInstanceOf(KyaApiError);
    });

    it("KyaNotFoundError includes handle", () => {
      const err = new KyaNotFoundError("ghost-agent");
      expect(err.status).toBe(404);
      expect(err.handle).toBe("ghost-agent");
      expect(err.name).toBe("KyaNotFoundError");
    });

    it("KyaNetworkError is a plain Error", () => {
      const err = new KyaNetworkError("timeout");
      expect(err.name).toBe("KyaNetworkError");
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── Network errors ───────────────────────────────────────────────────────

  describe("network error handling", () => {
    it("throws KyaNetworkError on fetch failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      );
      await expect(client.getScore("test-agent")).rejects.toBeInstanceOf(KyaNetworkError);
    });
  });
});
