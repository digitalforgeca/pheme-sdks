"""KYA SDK error types."""

from __future__ import annotations


class KyaError(Exception):
    """Base class for all KYA SDK errors."""


class KyaApiError(KyaError):
    """Raised when the KYA API returns an error response."""

    def __init__(self, status_code: int, message: str, body: str | None = None) -> None:
        self.status_code = status_code
        self.message = message
        self.body = body
        super().__init__(f"KYA API error {status_code}: {message}")


class KyaRateLimitError(KyaApiError):
    """Raised when the API responds with HTTP 429 Too Many Requests."""

    def __init__(self, retry_after: float = 1.0, body: str | None = None) -> None:
        self.retry_after = retry_after
        super().__init__(429, "Rate limit exceeded", body)

    def __str__(self) -> str:
        return f"Rate limit exceeded — retry after {self.retry_after}s"


class KyaAuthError(KyaApiError):
    """Raised when authentication fails (HTTP 401)."""

    def __init__(self, body: str | None = None) -> None:
        super().__init__(401, "Unauthorized — check your API key or token", body)


class KyaNotFoundError(KyaApiError):
    """Raised when the requested resource does not exist (HTTP 404)."""

    def __init__(self, resource: str = "Resource", body: str | None = None) -> None:
        self.resource = resource
        super().__init__(404, f"{resource} not found", body)


class KyaNetworkError(KyaError):
    """Raised when the network request fails (connection error, timeout, etc.)."""

    def __init__(self, message: str = "Network error — service may be unavailable") -> None:
        super().__init__(message)
