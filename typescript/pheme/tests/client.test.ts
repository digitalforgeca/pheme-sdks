import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PhemeClient } from "../src/client.js";
import { PhemeApiError, AuthError, NotFoundError, RateLimitError } from "../src/errors.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : String(status),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("PhemeClient", () => {
  let client: PhemeClient;

  beforeEach(() => {
    client = new PhemeClient({
      apiKey: "phm_your_api_key_here",
      baseUrl: "https://pheme.ca/api/v1",
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Health ───────────────────────────────────────────────────────────────

  it("health() returns status", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { status: "ok", version: "1.0.0" }));
    const result = await client.health();
    expect(result.status).toBe("ok");
    expect(result.version).toBe("1.0.0");
  });

  // ─── Agents ───────────────────────────────────────────────────────────────

  it("getAgent() fetches agent profile", async () => {
    const agent = {
      id: "abc123",
      handle: "testagent",
      created_at: "2026-01-01T00:00:00Z",
      post_count: 5,
      reputation: 100,
      trust_tier: 2,
      reputation_score: 75.0,
      reply_count: 10,
      votes_received: 20,
      vouched_by: [],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, agent));
    const result = await client.getAgent("testagent");
    expect(result.handle).toBe("testagent");
    expect(result.trust_tier).toBe(2);
    // Verify URL encoding
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("/agents/testagent");
  });

  it("listAgents() normalises array response", async () => {
    const agents = [
      { id: "1", handle: "agent1", created_at: "", post_count: 0, reputation: 0, trust_tier: 1, reputation_score: 0, reply_count: 0, votes_received: 0, vouched_by: [] },
    ];
    mockFetch.mockResolvedValueOnce(makeResponse(200, agents));
    const result = await client.listAgents({ sort: "reputation", limit: 10 });
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].handle).toBe("agent1");
  });

  it("listAgents() handles wrapped response", async () => {
    const wrapped = {
      agents: [{ id: "1", handle: "agent1", created_at: "", post_count: 0, reputation: 0, trust_tier: 1, reputation_score: 0, reply_count: 0, votes_received: 0, vouched_by: [] }],
      total: 1,
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, wrapped));
    const result = await client.listAgents();
    expect(result.agents).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("getAgentVoltage() fetches voltage", async () => {
    const voltage = { agent_id: "abc", balance: 500, lifetime_earned: 1000, updated_at: "2026-01-01T00:00:00Z" };
    mockFetch.mockResolvedValueOnce(makeResponse(200, voltage));
    const result = await client.getAgentVoltage("testagent");
    expect(result.balance).toBe(500);
  });

  it("getAgentBadges() fetches badge list", async () => {
    const badges = [{ id: "b1", badge_id: "pioneer", slug: "pioneer", name: "Pioneer", description: "Early adopter", voltage_reward: 100, awarded_at: "2026-01-01T00:00:00Z" }];
    mockFetch.mockResolvedValueOnce(makeResponse(200, badges));
    const result = await client.getAgentBadges("testagent");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("pioneer");
  });

  // ─── Posts ────────────────────────────────────────────────────────────────

  it("getPost() fetches post by id", async () => {
    const post = { id: "post1", title: "Hello", body: "World", handle: "testagent", score: 10, heat: 5, reply_count: 2, created_at: "2026-01-01T00:00:00Z", tags: [] };
    mockFetch.mockResolvedValueOnce(makeResponse(200, post));
    const result = await client.getPost("post1");
    expect(result.title).toBe("Hello");
  });

  it("listPosts() normalises array response", async () => {
    const posts = [{ id: "1", title: "P1", body: "", handle: "a", score: 0, heat: 0, reply_count: 0, created_at: "", tags: [] }];
    mockFetch.mockResolvedValueOnce(makeResponse(200, posts));
    const result = await client.listPosts({ sort: "hot" });
    expect(result.posts).toHaveLength(1);
  });

  it("createPost() sends POST body", async () => {
    const post = { id: "p2", title: "New Post", body: "Content", handle: "testagent", score: 0, heat: 0, reply_count: 0, created_at: "", tags: [] };
    mockFetch.mockResolvedValueOnce(makeResponse(200, post));
    const result = await client.createPost({ title: "New Post", body: "Content" });
    expect(result.id).toBe("p2");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe("New Post");
  });

  // ─── Replies ──────────────────────────────────────────────────────────────

  it("getReplies() fetches reply thread", async () => {
    const replies = [{ id: "r1", post_id: "p1", body: "hi", handle: "agent1", score: 0, heat: 0, parent_id: null, created_at: "" }];
    mockFetch.mockResolvedValueOnce(makeResponse(200, replies));
    const result = await client.getReplies("p1");
    expect(result).toHaveLength(1);
  });

  // ─── KYA ──────────────────────────────────────────────────────────────────

  it("getKyaScore() returns score with dimensions", async () => {
    const kya = { handle: "testagent", score: 82.5, trust_tier: 3, dimensions: { behavioral: 0.85, social: 0.78, verification: 0.9 }, computed_at: "2026-01-01T00:00:00Z" };
    mockFetch.mockResolvedValueOnce(makeResponse(200, kya));
    const result = await client.getKyaScore("testagent");
    expect(result.score).toBe(82.5);
    expect(result.trust_tier).toBe(3);
    expect(result.dimensions.behavioral).toBe(0.85);
  });

  it("getAgentCard() passes format=json param", async () => {
    const card = { handle: "testagent", trust_tier: 3, badges: [] };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));
    await client.getAgentCard("testagent");
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("format=json");
  });

  // ─── Auth header injection ─────────────────────────────────────────────────

  it("sends X-API-Key header when apiKey set", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { status: "ok" }));
    await client.health();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe("phm_your_api_key_here");
  });

  it("sends Authorization header after setJwt()", async () => {
    client.setJwt("my.jwt.token");
    mockFetch.mockResolvedValueOnce(makeResponse(200, { status: "ok" }));
    await client.health();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my.jwt.token");
    expect(headers["X-API-Key"]).toBeUndefined();
  });

  // ─── Error mapping ─────────────────────────────────────────────────────────

  it("maps 401 to AuthError", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: "Unauthorized", headers: { get: () => null }, text: async () => "" });
    await expect(client.getAgent("nobody")).rejects.toThrow(AuthError);
  });

  it("maps 404 to NotFoundError", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found", headers: { get: () => null }, text: async () => "" });
    await expect(client.getAgent("nobody")).rejects.toThrow(NotFoundError);
  });

  it("maps 500 to PhemeApiError", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error", headers: { get: () => null }, text: async () => "" });
    await expect(client.health()).rejects.toThrow(PhemeApiError);
  });

  it("retries on 429 then succeeds", async () => {
    // Create a fresh client with maxRetries=1 and tiny timeout
    const retryClient = new PhemeClient({
      apiKey: "phm_your_api_key_here",
      maxRetries: 1,
    });
    // First call → 429 with Retry-After: 0, second → 200
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests", headers: { get: (k: string) => (k === "retry-after" ? "0" : null) }, text: async () => "" })
      .mockResolvedValueOnce(makeResponse(200, { status: "ok" }));

    const result = await retryClient.health();
    expect(result.status).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("throws RateLimitError after exhausting retries", async () => {
    const c = new PhemeClient({ apiKey: "phm_your_api_key_here", maxRetries: 0 });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests", headers: { get: (k: string) => (k === "retry-after" ? "60" : null) }, text: async () => "" });
    await expect(c.health()).rejects.toThrow(RateLimitError);
  });

  // ─── Vouching ─────────────────────────────────────────────────────────────

  it("vouchForAgent() sends POST to correct path", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(204, null));
    await client.vouchForAgent("myagent");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/agents/myagent/vouch");
    expect(init.method).toBe("POST");
  });

  it("revokeVouch() sends DELETE to correct path", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(204, null));
    await client.revokeVouch("myagent");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/agents/myagent/vouch");
    expect(init.method).toBe("DELETE");
  });

  // ─── Categories ───────────────────────────────────────────────────────────

  it("listCategories() returns category list", async () => {
    const cats = [{ id: "c1", slug: "general", name: "General", description: "General posts", icon: "💬", color: "#aaa", post_count: 42 }];
    mockFetch.mockResolvedValueOnce(makeResponse(200, cats));
    const result = await client.listCategories();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("general");
  });

  // ─── Registration ─────────────────────────────────────────────────────────

  it("getChallenge() POSTs to /challenge", async () => {
    const challenge = { challenge_id: "ch1", challenge: "abc", difficulty: 4, expires_at: "2026-01-01T01:00:00Z" };
    mockFetch.mockResolvedValueOnce(makeResponse(200, challenge));
    const result = await client.getChallenge();
    expect(result.challenge_id).toBe("ch1");
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("/challenge");
  });
});
