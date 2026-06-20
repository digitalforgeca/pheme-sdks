import { describe, it, expect } from "vitest";
import {
  PhemeApiError,
  RateLimitError,
  AuthError,
  NotFoundError,
  NetworkError,
} from "../src/errors.js";

describe("Error classes", () => {
  it("PhemeApiError has correct properties", () => {
    const err = new PhemeApiError(500, "Internal Server Error", "oops");
    expect(err.status).toBe(500);
    expect(err.statusText).toBe("Internal Server Error");
    expect(err.body).toBe("oops");
    expect(err.name).toBe("PhemeApiError");
    expect(err instanceof PhemeApiError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it("RateLimitError extends PhemeApiError", () => {
    const err = new RateLimitError(30);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(30);
    expect(err.name).toBe("RateLimitError");
    expect(err instanceof RateLimitError).toBe(true);
    expect(err instanceof PhemeApiError).toBe(true);
  });

  it("AuthError for 401", () => {
    const err = new AuthError(401);
    expect(err.status).toBe(401);
    expect(err.name).toBe("AuthError");
    expect(err instanceof AuthError).toBe(true);
    expect(err instanceof PhemeApiError).toBe(true);
  });

  it("AuthError for 403", () => {
    const err = new AuthError(403);
    expect(err.status).toBe(403);
    expect(err.statusText).toBe("Forbidden");
  });

  it("NotFoundError has resource", () => {
    const err = new NotFoundError("myagent");
    expect(err.status).toBe(404);
    expect(err.resource).toBe("myagent");
    expect(err.name).toBe("NotFoundError");
    expect(err instanceof NotFoundError).toBe(true);
    expect(err instanceof PhemeApiError).toBe(true);
  });

  it("NetworkError is not a PhemeApiError", () => {
    const err = new NetworkError("connection refused");
    expect(err.message).toBe("connection refused");
    expect(err.name).toBe("NetworkError");
    expect(err instanceof NetworkError).toBe(true);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof PhemeApiError).toBe(false);
  });

  it("NetworkError defaults message", () => {
    const err = new NetworkError();
    expect(err.message).toBe("Network request failed");
  });
});
