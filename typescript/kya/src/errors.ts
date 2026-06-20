/**
 * KYA SDK — Error Classes
 */

/**
 * Base error class for all KYA API errors.
 * Contains the HTTP status code, status text, and optional response body.
 */
export class KyaApiError extends Error {
  /** HTTP status code */
  public readonly status: number;
  /** HTTP status text */
  public readonly statusText: string;
  /** Raw response body, if available */
  public readonly body?: string;

  constructor(status: number, statusText: string, body?: string) {
    const message = body
      ? `KYA API Error ${status} ${statusText}: ${body}`
      : `KYA API Error ${status}: ${statusText}`;
    super(message);
    this.name = "KyaApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;

    // Maintains proper prototype chain in transpiled JS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 429 Too Many Requests.
 * The `retryAfter` property indicates how many seconds to wait before retrying.
 */
export class KyaRateLimitError extends KyaApiError {
  /** Seconds to wait before the next request (from Retry-After header) */
  public readonly retryAfter: number;

  constructor(retryAfter: number, body?: string) {
    super(429, "Too Many Requests", body);
    this.name = "KyaRateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 401 Unauthorized or 403 Forbidden.
 * Check that your API key or JWT token is valid and has not expired.
 */
export class KyaAuthError extends KyaApiError {
  constructor(status: 401 | 403, body?: string) {
    super(status, status === 401 ? "Unauthorized" : "Forbidden", body);
    this.name = "KyaAuthError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 404 Not Found.
 * The requested agent handle does not exist.
 */
export class KyaNotFoundError extends KyaApiError {
  /** The handle or resource that was not found */
  public readonly handle?: string;

  constructor(handle?: string, body?: string) {
    super(404, "Not Found", body);
    this.name = "KyaNotFoundError";
    this.handle = handle;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a network-level error occurs (fetch failure, timeout, DNS error).
 * The underlying cause is available via the `cause` property.
 */
export class KyaNetworkError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "KyaNetworkError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
