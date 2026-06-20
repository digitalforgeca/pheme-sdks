"""Typed exception hierarchy for the Pheme SDK."""

from __future__ import annotations


class PhemeApiError(Exception):
    """Raised when the Pheme API returns a non-2xx response."""

    def __init__(self, status: int, message: str, body: str | None = None) -> None:
        super().__init__(f"Pheme API error {status}: {message}")
        self.status = status
        self.message = message
        self.body = body

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(status={self.status}, message={self.message!r})"


class PhemeAuthError(PhemeApiError):
    """Raised on 401 Unauthorized or 403 Forbidden responses."""

    def __init__(self, body: str | None = None) -> None:
        super().__init__(401, "Unauthorized — check your API key or JWT token", body)


class PhemeNotFoundError(PhemeApiError):
    """Raised when the requested resource does not exist (404)."""

    def __init__(self, resource: str | None = None, body: str | None = None) -> None:
        msg = f"Not found: {resource}" if resource else "Resource not found"
        super().__init__(404, msg, body)


class PhemeRateLimitError(PhemeApiError):
    """Raised on 429 Too Many Requests. Includes *retry_after* seconds."""

    def __init__(self, retry_after: float = 1.0, body: str | None = None) -> None:
        super().__init__(429, "Rate limit exceeded", body)
        self.retry_after = retry_after
