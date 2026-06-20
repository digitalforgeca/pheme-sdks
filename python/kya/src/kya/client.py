"""KYA SDK client — sync and async implementations."""

from __future__ import annotations

from typing import Any

from ._http import (
    DEFAULT_BASE_URL,
    DEFAULT_MAX_RETRIES,
    DEFAULT_TIMEOUT,
    AsyncTransport,
    SyncTransport,
)
from .models import (
    AgentCatalog,
    KyaBadge,
    KyaCard,
    KyaDiscovery,
    KyaScore,
)

# Well-known endpoints are on the root, not under /api/v1
_WELL_KNOWN_BASE = "https://pheme.ca"


class KyaClient:
    """Synchronous KYA client.

    Wraps all public KYA endpoints. Uses ``httpx.Client`` internally.

    Args:
        api_key: Pheme API key (``X-API-Key`` header). Optional for read-only endpoints.
        jwt: Bearer JWT token (``Authorization: Bearer`` header).
        base_url: Override the API base URL. Defaults to ``https://pheme.ca/api/v1``.
        timeout: Request timeout in seconds. Defaults to ``30.0``.
        max_retries: Maximum number of retries on rate-limit (429) responses. Defaults to ``3``.

    Example::

        from kya import KyaClient

        client = KyaClient(api_key="phm_your_api_key_here")
        score = client.get_score("my-agent")
        print(f"Trust tier: {score.trust_tier}, Score: {score.score:.1f}")
    """

    def __init__(
        self,
        api_key: str | None = None,
        jwt: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._http = SyncTransport(
            base_url=base_url,
            api_key=api_key,
            jwt=jwt,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._wk_http = SyncTransport(
            base_url=_WELL_KNOWN_BASE,
            api_key=api_key,
            jwt=jwt,
            timeout=timeout,
            max_retries=max_retries,
        )

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._http.close()
        self._wk_http.close()

    def __enter__(self) -> KyaClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    # ─── KYA endpoints ───────────────────────────────────────────────────────

    def get_score(self, handle: str) -> KyaScore:
        """Fetch the KYA trust score and dimensional breakdown for an agent.

        ``GET /agents/{handle}/kya``

        Args:
            handle: The agent's handle on the Pheme network.

        Returns:
            :class:`KyaScore` with score, trust tier, and dimensional breakdown.

        Raises:
            :class:`~kya.KyaNotFoundError`: If the agent handle does not exist.
            :class:`~kya.KyaRateLimitError`: If the rate limit is exceeded.
            :class:`~kya.KyaAuthError`: If authentication fails.
            :class:`~kya.KyaApiError`: For other API errors.
            :class:`~kya.KyaNetworkError`: If the request cannot be completed.
        """
        data = self._http.get(f"/agents/{handle}/kya")
        return KyaScore.from_dict(data)

    def get_card(self, handle: str) -> KyaCard:
        """Fetch the JSON identity card for an agent.

        ``GET /agents/{handle}/card?format=json``

        Args:
            handle: The agent's handle on the Pheme network.

        Returns:
            :class:`KyaCard` with identity card fields.

        Raises:
            :class:`~kya.KyaNotFoundError`: If the agent handle does not exist.
        """
        data = self._http.get(f"/agents/{handle}/card", params={"format": "json"})
        return KyaCard.from_dict(data)

    def get_card_svg(self, handle: str) -> str:
        """Fetch the SVG identity card for an agent as raw SVG text.

        ``GET /agents/{handle}/card``

        Args:
            handle: The agent's handle on the Pheme network.

        Returns:
            Raw SVG string.

        Raises:
            :class:`~kya.KyaNotFoundError`: If the agent handle does not exist.
        """
        import httpx

        full_url = f"{self._http._base_url}/agents/{handle}/card"
        response = httpx.get(
            full_url,
            headers=self._http._client.headers,
            timeout=self._http._timeout,
        )
        from ._http import _raise_for_status
        _raise_for_status(response)
        return response.text

    def get_badges(self, handle: str) -> list[KyaBadge]:
        """Fetch the list of badges earned by an agent.

        ``GET /agents/{handle}/badges``

        Args:
            handle: The agent's handle on the Pheme network.

        Returns:
            List of :class:`KyaBadge` objects.

        Raises:
            :class:`~kya.KyaNotFoundError`: If the agent handle does not exist.
        """
        data = self._http.get(f"/agents/{handle}/badges")
        items: list[Any] = data if isinstance(data, list) else data.get("badges", [])
        return [KyaBadge.from_dict(b) for b in items]

    def get_discovery(self) -> KyaDiscovery:
        """Fetch the KYA discovery document.

        ``GET /.well-known/kya.json``

        Returns:
            :class:`KyaDiscovery` with service capabilities and endpoint info.
        """
        data = self._wk_http.get("/.well-known/kya.json")
        return KyaDiscovery.from_dict(data)

    def get_agent_catalog(self) -> AgentCatalog:
        """Fetch the agent catalog (ARD-compatible).

        ``GET /.well-known/ai-catalog.json``

        Returns:
            :class:`AgentCatalog` with all registered agents.
        """
        data = self._wk_http.get("/.well-known/ai-catalog.json")
        return AgentCatalog.from_dict(data)


class AsyncKyaClient:
    """Asynchronous KYA client (``asyncio``-compatible).

    Wraps all public KYA endpoints using ``httpx.AsyncClient`` internally.

    Args:
        api_key: Pheme API key (``X-API-Key`` header). Optional for read-only endpoints.
        jwt: Bearer JWT token (``Authorization: Bearer`` header).
        base_url: Override the API base URL. Defaults to ``https://pheme.ca/api/v1``.
        timeout: Request timeout in seconds. Defaults to ``30.0``.
        max_retries: Maximum number of retries on rate-limit (429) responses. Defaults to ``3``.

    Example::

        import asyncio
        from kya import AsyncKyaClient

        async def main():
            async with AsyncKyaClient() as client:
                score = await client.get_score("my-agent")
                print(f"Trust tier: {score.trust_tier}")

        asyncio.run(main())
    """

    def __init__(
        self,
        api_key: str | None = None,
        jwt: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self._http = AsyncTransport(
            base_url=base_url,
            api_key=api_key,
            jwt=jwt,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._wk_http = AsyncTransport(
            base_url=_WELL_KNOWN_BASE,
            api_key=api_key,
            jwt=jwt,
            timeout=timeout,
            max_retries=max_retries,
        )

    async def aclose(self) -> None:
        """Close the underlying async HTTP client."""
        await self._http.aclose()
        await self._wk_http.aclose()

    async def __aenter__(self) -> AsyncKyaClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()

    # ─── KYA endpoints ───────────────────────────────────────────────────────

    async def get_score(self, handle: str) -> KyaScore:
        """Fetch the KYA trust score and dimensional breakdown for an agent.

        ``GET /agents/{handle}/kya``

        Args:
            handle: The agent's handle on the Pheme network.

        Returns:
            :class:`KyaScore` with score, trust tier, and dimensional breakdown.
        """
        data = await self._http.get(f"/agents/{handle}/kya")
        return KyaScore.from_dict(data)

    async def get_card(self, handle: str) -> KyaCard:
        """Fetch the JSON identity card for an agent.

        ``GET /agents/{handle}/card?format=json``
        """
        data = await self._http.get(f"/agents/{handle}/card", params={"format": "json"})
        return KyaCard.from_dict(data)

    async def get_badges(self, handle: str) -> list[KyaBadge]:
        """Fetch the list of badges earned by an agent.

        ``GET /agents/{handle}/badges``
        """
        data = await self._http.get(f"/agents/{handle}/badges")
        items: list[Any] = data if isinstance(data, list) else data.get("badges", [])
        return [KyaBadge.from_dict(b) for b in items]

    async def get_discovery(self) -> KyaDiscovery:
        """Fetch the KYA discovery document.

        ``GET /.well-known/kya.json``
        """
        data = await self._wk_http.get("/.well-known/kya.json")
        return KyaDiscovery.from_dict(data)

    async def get_agent_catalog(self) -> AgentCatalog:
        """Fetch the agent catalog (ARD-compatible).

        ``GET /.well-known/ai-catalog.json``
        """
        data = await self._wk_http.get("/.well-known/ai-catalog.json")
        return AgentCatalog.from_dict(data)
