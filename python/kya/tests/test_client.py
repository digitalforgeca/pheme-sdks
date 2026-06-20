"""Tests for KYA SDK client — uses pytest-httpx to mock responses."""

from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from kya import AsyncKyaClient, KyaClient
from kya.errors import KyaAuthError, KyaNotFoundError

BASE = "https://pheme.ca/api/v1"
WK_BASE = "https://pheme.ca"

SCORE_PAYLOAD = {
    "handle": "test-agent",
    "score": 78.5,
    "trust_tier": 3,
    "dimensions": {"behavioral": 0.8, "social": 0.7, "verification": 0.9},
    "updated_at": "2026-01-01T00:00:00Z",
}

BADGES_PAYLOAD = [
    {
        "id": "b1",
        "badge_id": "pioneer",
        "slug": "pioneer",
        "name": "Pioneer",
        "description": "First users",
        "voltage_reward": 50,
        "awarded_at": "2026-01-01T00:00:00Z",
    }
]

CARD_PAYLOAD = {
    "handle": "test-agent",
    "display_name": "Test Agent",
    "trust_tier": 3,
    "score": 78.5,
}

DISCOVERY_PAYLOAD = {
    "version": "1.0",
    "endpoint": "https://pheme.ca/api/v1",
    "features": ["scoring", "badges", "card"],
}

CATALOG_PAYLOAD = {
    "agents": [
        {"handle": "agent-a", "trust_tier": 2},
        {"handle": "agent-b", "trust_tier": 4},
    ]
}


# ─── Sync client tests ───────────────────────────────────────────────────────

class TestKyaClientScore:
    def test_get_score(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(url=f"{BASE}/agents/test-agent/kya", json=SCORE_PAYLOAD)
        client = KyaClient()
        score = client.get_score("test-agent")
        assert score.handle == "test-agent"
        assert score.score == 78.5
        assert score.trust_tier == 3
        assert score.dimensions.behavioral == 0.8

    def test_get_score_not_found(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/no-such-agent/kya",
            status_code=404,
            json={"detail": "Agent not found"},
        )
        client = KyaClient()
        with pytest.raises(KyaNotFoundError):
            client.get_score("no-such-agent")

    def test_get_score_auth_error(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/locked/kya",
            status_code=401,
        )
        client = KyaClient()
        with pytest.raises(KyaAuthError):
            client.get_score("locked")

    def test_get_score_rate_limit_retry(self, httpx_mock: HTTPXMock) -> None:
        # First request: 429; second: success
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/kya",
            status_code=429,
            headers={"Retry-After": "0"},
        )
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/kya",
            json=SCORE_PAYLOAD,
        )
        client = KyaClient(max_retries=3)
        score = client.get_score("test-agent")
        assert score.trust_tier == 3


class TestKyaClientBadges:
    def test_get_badges(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/badges",
            json=BADGES_PAYLOAD,
        )
        client = KyaClient()
        badges = client.get_badges("test-agent")
        assert len(badges) == 1
        assert badges[0].slug == "pioneer"
        assert badges[0].voltage_reward == 50

    def test_get_badges_wrapped(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/badges",
            json={"badges": BADGES_PAYLOAD},
        )
        client = KyaClient()
        badges = client.get_badges("test-agent")
        assert len(badges) == 1


class TestKyaClientCard:
    def test_get_card(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/card?format=json",
            json=CARD_PAYLOAD,
        )
        client = KyaClient()
        card = client.get_card("test-agent")
        assert card.handle == "test-agent"
        assert card.trust_tier == 3


class TestKyaClientDiscovery:
    def test_get_discovery(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{WK_BASE}/.well-known/kya.json",
            json=DISCOVERY_PAYLOAD,
        )
        client = KyaClient()
        disc = client.get_discovery()
        assert disc.version == "1.0"
        assert "scoring" in disc.features

    def test_get_catalog(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{WK_BASE}/.well-known/ai-catalog.json",
            json=CATALOG_PAYLOAD,
        )
        client = KyaClient()
        catalog = client.get_agent_catalog()
        assert len(catalog.agents) == 2
        assert catalog.agents[0].handle == "agent-a"


# ─── Async client tests ───────────────────────────────────────────────────────

class TestAsyncKyaClient:
    @pytest.mark.asyncio
    async def test_get_score(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(url=f"{BASE}/agents/test-agent/kya", json=SCORE_PAYLOAD)
        async with AsyncKyaClient() as client:
            score = await client.get_score("test-agent")
        assert score.handle == "test-agent"
        assert score.trust_tier == 3

    @pytest.mark.asyncio
    async def test_get_badges(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(url=f"{BASE}/agents/test-agent/badges", json=BADGES_PAYLOAD)
        async with AsyncKyaClient() as client:
            badges = await client.get_badges("test-agent")
        assert badges[0].name == "Pioneer"

    @pytest.mark.asyncio
    async def test_not_found(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/ghost/kya",
            status_code=404,
        )
        async with AsyncKyaClient() as client:
            with pytest.raises(KyaNotFoundError):
                await client.get_score("ghost")

    @pytest.mark.asyncio
    async def test_rate_limit_retry(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/kya",
            status_code=429,
            headers={"Retry-After": "0"},
        )
        httpx_mock.add_response(
            url=f"{BASE}/agents/test-agent/kya",
            json=SCORE_PAYLOAD,
        )
        async with AsyncKyaClient(max_retries=3) as client:
            score = await client.get_score("test-agent")
        assert score.score == 78.5

    @pytest.mark.asyncio
    async def test_get_discovery(self, httpx_mock: HTTPXMock) -> None:
        httpx_mock.add_response(
            url=f"{WK_BASE}/.well-known/kya.json",
            json=DISCOVERY_PAYLOAD,
        )
        async with AsyncKyaClient() as client:
            disc = await client.get_discovery()
        assert disc.version == "1.0"
