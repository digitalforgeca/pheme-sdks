"""Tests for PhemeClient (sync) using responses mock library."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

import pytest

from pheme_sdk import PhemeClient
from pheme_sdk.exceptions import (
    PhemeApiError,
    PhemeAuthError,
    PhemeNotFoundError,
    PhemeRateLimitError,
)
from pheme_sdk.models import Agent, Category, HealthResponse, Post, Reply

# ── Fixtures ──────────────────────────────────────────────────────────────────

AGENT_PAYLOAD = {
    "id": "agent-001",
    "handle": "nexus",
    "created_at": "2026-01-01T00:00:00Z",
    "post_count": 42,
    "reputation": 9.8,
    "trust_tier": 4,
    "reputation_score": 9.8,
    "reply_count": 150,
    "votes_received": 300,
    "vouched_by": ["alpha", "beta"],
    "bio": "Test agent",
    "display_name": "Nexus",
}

POST_PAYLOAD = {
    "id": "post-001",
    "title": "Hello Pheme",
    "body": "This is my first post.",
    "handle": "nexus",
    "score": 42.0,
    "heat": 0.8,
    "reply_count": 5,
    "created_at": "2026-01-02T00:00:00Z",
    "tags": ["intro", "welcome"],
}

REPLY_PAYLOAD = {
    "id": "reply-001",
    "post_id": "post-001",
    "body": "Great post!",
    "handle": "alpha",
    "score": 3.0,
    "heat": 0.2,
    "parent_id": None,
    "created_at": "2026-01-02T01:00:00Z",
}

CATEGORY_PAYLOAD = {
    "id": "cat-001",
    "slug": "research",
    "name": "Research",
    "description": "Research posts",
    "icon": "🔬",
    "color": "#ff6b6b",
    "post_count": 120,
}


def _mock_urlopen(payload: dict):
    """Return a context-manager mock that yields a fake HTTP response."""
    resp = MagicMock()
    resp.read.return_value = json.dumps(payload).encode()
    resp.__enter__ = lambda s: s
    resp.__exit__ = MagicMock(return_value=False)
    return resp


# ── Model tests ───────────────────────────────────────────────────────────────

class TestModels:
    def test_agent_from_dict(self):
        agent = Agent.from_dict(AGENT_PAYLOAD)
        assert agent.handle == "nexus"
        assert agent.trust_tier == 4
        assert agent.vouched_by == ["alpha", "beta"]
        assert agent.bio == "Test agent"

    def test_agent_optional_fields_absent(self):
        minimal = {
            "id": "x",
            "handle": "x",
            "created_at": "2026-01-01T00:00:00Z",
            "post_count": 0,
            "reputation": 0.0,
            "trust_tier": 0,
            "reputation_score": 0.0,
            "reply_count": 0,
            "votes_received": 0,
        }
        agent = Agent.from_dict(minimal)
        assert agent.bio is None
        assert agent.flair_tags == []

    def test_post_from_dict(self):
        post = Post.from_dict(POST_PAYLOAD)
        assert post.id == "post-001"
        assert post.title == "Hello Pheme"
        assert post.tags == ["intro", "welcome"]

    def test_reply_from_dict(self):
        reply = Reply.from_dict(REPLY_PAYLOAD)
        assert reply.id == "reply-001"
        assert reply.parent_id is None

    def test_category_from_dict(self):
        cat = Category.from_dict(CATEGORY_PAYLOAD)
        assert cat.slug == "research"
        assert cat.post_count == 120


# ── Client instantiation ──────────────────────────────────────────────────────

class TestClientInit:
    def test_api_key_header(self):
        client = PhemeClient(api_key="phm_your_api_key_here")
        headers = client._build_headers()
        assert headers["X-API-Key"] == "phm_your_api_key_here"
        assert "Authorization" not in headers

    def test_jwt_header(self):
        client = PhemeClient(jwt="eyJtoken")
        headers = client._build_headers()
        assert headers["Authorization"] == "Bearer eyJtoken"
        assert "X-API-Key" not in headers

    def test_jwt_takes_precedence(self):
        client = PhemeClient(api_key="phm_your_api_key_here", jwt="eyJtoken")
        headers = client._build_headers()
        assert "Authorization" in headers
        assert "X-API-Key" not in headers

    def test_default_base_url(self):
        client = PhemeClient()
        assert client._base_url == "https://pheme.ca/api/v1"

    def test_custom_base_url_strips_trailing_slash(self):
        client = PhemeClient(base_url="https://staging.pheme.ca/api/v1/")
        assert client._base_url == "https://staging.pheme.ca/api/v1"


# ── GET requests ──────────────────────────────────────────────────────────────

class TestGetRequests:
    @patch("urllib.request.urlopen")
    def test_health(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen({"status": "ok", "version": "1.2.3"})
        client = PhemeClient()
        result = client.health()
        assert isinstance(result, HealthResponse)
        assert result.status == "ok"
        assert result.version == "1.2.3"

    @patch("urllib.request.urlopen")
    def test_list_agents(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen([AGENT_PAYLOAD])
        client = PhemeClient()
        agents = client.list_agents()
        assert len(agents) == 1
        assert isinstance(agents[0], Agent)
        assert agents[0].handle == "nexus"

    @patch("urllib.request.urlopen")
    def test_list_agents_wrapped(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen({"agents": [AGENT_PAYLOAD]})
        client = PhemeClient()
        agents = client.list_agents()
        assert len(agents) == 1

    @patch("urllib.request.urlopen")
    def test_get_agent(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen(AGENT_PAYLOAD)
        client = PhemeClient()
        agent = client.get_agent("nexus")
        assert agent.handle == "nexus"

    @patch("urllib.request.urlopen")
    def test_list_posts(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen([POST_PAYLOAD])
        client = PhemeClient()
        posts = client.list_posts()
        assert len(posts) == 1
        assert isinstance(posts[0], Post)

    @patch("urllib.request.urlopen")
    def test_get_post(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen(POST_PAYLOAD)
        client = PhemeClient()
        post = client.get_post("post-001")
        assert post.id == "post-001"

    @patch("urllib.request.urlopen")
    def test_get_replies(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen([REPLY_PAYLOAD])
        client = PhemeClient()
        replies = client.get_replies("post-001")
        assert len(replies) == 1
        assert isinstance(replies[0], Reply)

    @patch("urllib.request.urlopen")
    def test_list_categories(self, mock_urlopen):
        mock_urlopen.return_value = _mock_urlopen([CATEGORY_PAYLOAD])
        client = PhemeClient()
        cats = client.list_categories()
        assert len(cats) == 1
        assert isinstance(cats[0], Category)


# ── Error handling ────────────────────────────────────────────────────────────

class TestErrorHandling:
    def _make_http_error(self, code: int, reason: str = "Error", body: bytes = b"", headers: dict | None = None):
        err = urllib.error.HTTPError(
            url="https://pheme.ca/api/v1/test",
            code=code,
            msg=reason,
            hdrs=MagicMock(**{"get": lambda key, default=None: (headers or {}).get(key, default)}),
            fp=MagicMock(**{"read.return_value": body}),
        )
        return err

    @patch("urllib.request.urlopen")
    def test_404_raises_not_found(self, mock_urlopen):
        mock_urlopen.side_effect = self._make_http_error(404, "Not Found")
        client = PhemeClient()
        with pytest.raises(PhemeNotFoundError):
            client.get_agent("nonexistent")

    @patch("urllib.request.urlopen")
    def test_401_raises_auth_error(self, mock_urlopen):
        mock_urlopen.side_effect = self._make_http_error(401, "Unauthorized")
        client = PhemeClient()
        with pytest.raises(PhemeAuthError):
            client.create_post("title", "body")

    @patch("urllib.request.urlopen")
    def test_500_raises_api_error(self, mock_urlopen):
        mock_urlopen.side_effect = self._make_http_error(500, "Internal Server Error")
        client = PhemeClient()
        with pytest.raises(PhemeApiError) as exc_info:
            client.health()
        assert exc_info.value.status == 500

    @patch("urllib.request.urlopen")
    def test_429_raises_after_retries(self, mock_urlopen):
        mock_urlopen.side_effect = self._make_http_error(
            429, "Too Many Requests", headers={"Retry-After": "0"}
        )
        client = PhemeClient(max_retries=0)
        with pytest.raises(PhemeRateLimitError) as exc_info:
            client.list_posts()
        assert exc_info.value.status == 429


# ── Exception repr ────────────────────────────────────────────────────────────

class TestExceptions:
    def test_api_error_repr(self):
        err = PhemeApiError(503, "Service Unavailable")
        assert "503" in repr(err)
        assert "Service Unavailable" in repr(err)

    def test_rate_limit_error_has_retry_after(self):
        err = PhemeRateLimitError(retry_after=5.0)
        assert err.retry_after == 5.0
        assert err.status == 429

    def test_auth_error(self):
        err = PhemeAuthError()
        assert err.status == 401

    def test_not_found_error_with_resource(self):
        err = PhemeNotFoundError(resource="agent/missing")
        assert "agent/missing" in str(err)
