"""Internal HTTP transport layer for the KYA SDK."""

from __future__ import annotations

import time
from typing import Any

import httpx

from .errors import (
    KyaApiError,
    KyaAuthError,
    KyaNetworkError,
    KyaNotFoundError,
    KyaRateLimitError,
)

DEFAULT_BASE_URL = "https://pheme.ca/api/v1"
DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3


def _build_headers(
    api_key: str | None = None,
    jwt: str | None = None,
) -> dict[str, str]:
    headers: dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": "kya-sdk-python/0.1.0",
    }
    if api_key:
        headers["X-API-Key"] = api_key
    if jwt:
        headers["Authorization"] = f"Bearer {jwt}"
    return headers


def _raise_for_status(response: httpx.Response) -> None:
    """Map HTTP error codes to typed SDK exceptions."""
    if response.is_success:
        return

    body: str | None = None
    try:
        body = response.text
    except Exception:
        pass

    if response.status_code == 401:
        raise KyaAuthError(body)

    if response.status_code == 404:
        raise KyaNotFoundError(body=body)

    if response.status_code == 429:
        retry_after = float(response.headers.get("Retry-After", "1"))
        raise KyaRateLimitError(retry_after=retry_after, body=body)

    try:
        detail = response.json().get("detail") or response.json().get("error") or response.text
    except Exception:
        detail = response.text or response.reason_phrase

    raise KyaApiError(response.status_code, str(detail), body)


# ─── Sync transport ──────────────────────────────────────────────────────────

class SyncTransport:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str | None = None,
        jwt: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._jwt = jwt
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = httpx.Client(
            base_url=self._base_url,
            headers=_build_headers(api_key, jwt),
            timeout=timeout,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> SyncTransport:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return self._request("GET", path, params=params)

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
    ) -> Any:
        attempts = 0
        last_exc: Exception | None = None

        while attempts < self._max_retries:
            try:
                response = self._client.request(method, path, params=params, json=json)
                _raise_for_status(response)
                return response.json()
            except KyaRateLimitError as exc:
                attempts += 1
                last_exc = exc
                if attempts < self._max_retries:
                    time.sleep(exc.retry_after)
            except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as exc:
                raise KyaNetworkError(str(exc)) from exc
            except (KyaApiError,):
                raise

        assert last_exc is not None
        raise last_exc


# ─── Async transport ─────────────────────────────────────────────────────────

class AsyncTransport:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str | None = None,
        jwt: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._jwt = jwt
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers=_build_headers(api_key, jwt),
            timeout=timeout,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> AsyncTransport:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", path, params=params)

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
    ) -> Any:
        import asyncio

        attempts = 0
        last_exc: Exception | None = None

        while attempts < self._max_retries:
            try:
                response = await self._client.request(method, path, params=params, json=json)
                _raise_for_status(response)
                return response.json()
            except KyaRateLimitError as exc:
                attempts += 1
                last_exc = exc
                if attempts < self._max_retries:
                    await asyncio.sleep(exc.retry_after)
            except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as exc:
                raise KyaNetworkError(str(exc)) from exc
            except (KyaApiError,):
                raise

        assert last_exc is not None
        raise last_exc
