/**
 * Pheme SDK — HTTP Transport Layer
 *
 * Handles request construction, auth header injection, error mapping,
 * and automatic retry on HTTP 429 with Retry-After back-off.
 */

import { AuthError, NetworkError, NotFoundError, PhemeApiError, RateLimitError } from "./errors.js";

export interface HttpClientOptions {
  /** Base URL for the Pheme API. Defaults to https://pheme.ca/api/v1 */
  baseUrl?: string;
  /** API key for X-API-Key authentication */
  apiKey?: string;
  /** JWT token for Authorization: Bearer authentication */
  jwt?: string;
  /** Request timeout in milliseconds. Defaults to 10000 (10s) */
  timeout?: number;
  /** Maximum number of retries on 429. Defaults to 3 */
  maxRetries?: number;
}

const DEFAULT_BASE_URL = "https://pheme.ca/api/v1";
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpClient {
  private readonly baseUrl: string;
  private apiKey?: string;
  private jwt?: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.jwt = options.jwt;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Update the API key at runtime (e.g. after registration).
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.jwt = undefined;
  }

  /**
   * Update the JWT token at runtime (e.g. after operator login).
   */
  setJwt(jwt: string): void {
    this.jwt = jwt;
    this.apiKey = undefined;
  }

  /**
   * Clear all authentication credentials.
   */
  clearAuth(): void {
    this.apiKey = undefined;
    this.jwt = undefined;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extra,
    };
    if (this.jwt) {
      headers["Authorization"] = `Bearer ${this.jwt}`;
    } else if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async mapError(response: Response): Promise<never> {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      // ignore body read failure
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(response.status as 401 | 403, body);
    }
    if (response.status === 404) {
      throw new NotFoundError(undefined, body);
    }
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "60", 10);
      throw new RateLimitError(isNaN(retryAfter) ? 60 : retryAfter, body);
    }
    throw new PhemeApiError(response.status, response.statusText, body);
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const headers = this.buildHeaders(options.headers);

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === "AbortError") {
          throw new NetworkError(`Request timed out after ${this.timeout}ms`);
        }
        throw new NetworkError("Network request failed", err);
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5", 10);
        const waitMs = (isNaN(retryAfter) ? 5 : retryAfter) * 1000;
        await sleep(waitMs);
        attempt++;
        continue;
      }

      if (!response.ok) {
        await this.mapError(response);
      }

      // 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new PhemeApiError(response.status, "Failed to parse JSON response");
      }
    }
    // Exhausted retries on 429
    throw new RateLimitError(60);
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
