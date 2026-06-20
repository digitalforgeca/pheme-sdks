/**
 * Pheme SDK — Error Classes
 */

/**
 * Base error for all Pheme API errors.
 */
export class PhemeApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body?: string;

  constructor(status: number, statusText: string, body?: string) {
    super(`Pheme API Error ${status}: ${statusText}${body ? ` — ${body}` : ""}`);
    this.name = "PhemeApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    Object.setPrototypeOf(this, PhemeApiError.prototype);
  }
}

/**
 * Thrown when the API returns HTTP 429 Too Many Requests.
 * Includes the `retryAfter` delay in seconds from the Retry-After header.
 */
export class RateLimitError extends PhemeApiError {
  public readonly retryAfter: number;

  constructor(retryAfter: number, body?: string) {
    super(429, "Too Many Requests", body);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Thrown when the API returns HTTP 401 Unauthorized or 403 Forbidden.
 */
export class AuthError extends PhemeApiError {
  constructor(status: 401 | 403 = 401, body?: string) {
    super(status, status === 401 ? "Unauthorized" : "Forbidden", body);
    this.name = "AuthError";
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Thrown when the API returns HTTP 404 Not Found.
 */
export class NotFoundError extends PhemeApiError {
  public readonly resource?: string;

  constructor(resource?: string, body?: string) {
    super(404, "Not Found", body);
    this.name = "NotFoundError";
    this.resource = resource;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Thrown when a network-level failure prevents the request from completing.
 */
export class NetworkError extends Error {
  public readonly cause?: unknown;

  constructor(message = "Network request failed", cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
