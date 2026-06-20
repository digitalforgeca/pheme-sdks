/**
 * KYA SDK — HTTP transport layer with retry, auth, and timeout support.
 */

import { KyaApiError, KyaAuthError, KyaNetworkError, KyaNotFoundError, KyaRateLimitError } from "./errors.js";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpClientConfig {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  timeout: number;
  maxRetries: number;
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the Retry-After header value into a millisecond delay.
 * Handles both delta-seconds and HTTP-date formats.
 */
function parseRetryAfter(header: string | null): number {
  if (!header) return 1000;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return Math.max(seconds, 1) * 1000;
  // HTTP-date format
  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(date.getTime() - Date.now(), 0);
  }
  return 1000;
}

/**
 * Minimal HTTP client for the KYA API.
 * Handles auth headers, JSON serialization, error mapping, and retry on 429.
 */
export class HttpClient {
  private readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
  }

  /**
   * Build auth headers based on configured credentials.
   * JWT token takes precedence over API key.
   */
  private authHeaders(): Record<string, string> {
    if (this.config.token) {
      return { Authorization: `Bearer ${this.config.token}` };
    }
    if (this.config.apiKey) {
      return { "X-API-Key": this.config.apiKey };
    }
    return {};
  }

  /**
   * Execute an HTTP request against the given path.
   * Automatically retries on 429 responses up to `maxRetries` times.
   */
  async request<T>(path: string, options: RequestOptions = {}, handle?: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const method = options.method ?? "GET";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...this.authHeaders(),
      ...options.headers,
    };

    let attempt = 0;
    const maxAttempts = this.config.maxRetries + 1;

    for (let _i = 0; _i < maxAttempts + 1; _i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      let response: Response;

      try {
        response = await fetch(url, {
          method,
          headers,
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: options.signal ?? controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new KyaNetworkError(`Request timed out after ${this.config.timeout}ms`, err);
        }
        throw new KyaNetworkError("Network error — could not reach the KYA service", err);
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle rate limiting with retry
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = parseInt(retryAfterHeader ?? "1", 10) || 1;
        const retryAfterMs = parseRetryAfter(retryAfterHeader);

        if (attempt < this.config.maxRetries) {
          attempt++;
          await sleep(retryAfterMs);
          continue;
        }

        const body = await response.text().catch(() => undefined);
        throw new KyaRateLimitError(retryAfterSeconds, body);
      }

      // Should never be reached, but satisfies TypeScript
      /* istanbul ignore next */
      if (_i >= maxAttempts) break;

      // Map HTTP error codes to typed errors
      if (!response.ok) {
        const body = await response.text().catch(() => undefined);

        switch (response.status) {
          case 401:
          case 403:
            throw new KyaAuthError(response.status as 401 | 403, body);
          case 404:
            throw new KyaNotFoundError(handle, body);
          default:
            throw new KyaApiError(response.status, response.statusText, body);
        }
      }

      // Parse JSON response
      try {
        return (await response.json()) as T;
      } catch (err) {
        throw new KyaNetworkError("Failed to parse JSON response", err);
      }
    }
  }

  /**
   * Fetch a raw text/SVG response (used for card SVG endpoint).
   */
  async requestText(path: string, options: RequestOptions = {}): Promise<string> {
    const url = `${this.config.baseUrl}${path}`;
    const method = options.method ?? "GET";

    const headers: Record<string, string> = {
      Accept: "image/svg+xml,text/plain,*/*",
      ...this.authHeaders(),
      ...options.headers,
    };

    let attempt = 0;
    const maxAttempts = this.config.maxRetries + 1;

    for (let _i = 0; _i < maxAttempts + 1; _i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      let response: Response;

      try {
        response = await fetch(url, {
          method,
          headers,
          signal: options.signal ?? controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new KyaNetworkError(`Request timed out after ${this.config.timeout}ms`, err);
        }
        throw new KyaNetworkError("Network error — could not reach the KYA service", err);
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterMs = parseRetryAfter(retryAfterHeader);
        if (attempt < this.config.maxRetries) {
          attempt++;
          await sleep(retryAfterMs);
          continue;
        }
        const retryAfterSeconds = parseInt(retryAfterHeader ?? "1", 10) || 1;
        throw new KyaRateLimitError(retryAfterSeconds);
      }

      /* istanbul ignore next */
      if (_i >= maxAttempts) break;

      if (!response.ok) {
        const body = await response.text().catch(() => undefined);
        switch (response.status) {
          case 401:
          case 403:
            throw new KyaAuthError(response.status as 401 | 403, body);
          case 404:
            throw new KyaNotFoundError(undefined, body);
          default:
            throw new KyaApiError(response.status, response.statusText, body);
        }
      }

      return response.text();
    }
  }
}
