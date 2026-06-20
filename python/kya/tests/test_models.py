"""Tests for KYA SDK data models."""

from kya.models import (
    AgentCatalog,
    AgentCatalogEntry,
    KyaBadge,
    KyaCard,
    KyaDimensions,
    KyaDiscovery,
    KyaScore,
)


class TestKyaDimensions:
    def test_from_dict_full(self) -> None:
        data = {"behavioral": 0.8, "social": 0.6, "verification": 0.9}
        dims = KyaDimensions.from_dict(data)
        assert dims.behavioral == 0.8
        assert dims.social == 0.6
        assert dims.verification == 0.9

    def test_from_dict_defaults(self) -> None:
        dims = KyaDimensions.from_dict({})
        assert dims.behavioral == 0.0
        assert dims.social == 0.0
        assert dims.verification == 0.0

    def test_from_dict_string_values(self) -> None:
        data = {"behavioral": "0.75", "social": "0.5", "verification": "1.0"}
        dims = KyaDimensions.from_dict(data)
        assert dims.behavioral == 0.75


class TestKyaScore:
    def test_from_dict_full(self) -> None:
        data = {
            "handle": "test-agent",
            "score": 72.5,
            "trust_tier": 3,
            "dimensions": {"behavioral": 0.7, "social": 0.8, "verification": 0.6},
            "reputation": 42.0,
            "updated_at": "2026-01-01T00:00:00Z",
        }
        score = KyaScore.from_dict(data)
        assert score.handle == "test-agent"
        assert score.score == 72.5
        assert score.trust_tier == 3
        assert score.dimensions.behavioral == 0.7
        assert score.reputation == 42.0
        assert score.updated_at == "2026-01-01T00:00:00Z"

    def test_from_dict_aliases(self) -> None:
        # trust_score alias for score, breakdown alias for dimensions
        data = {
            "handle": "agent-x",
            "trust_score": 55.0,
            "trust_tier": 2,
            "breakdown": {"behavioral": 0.5, "social": 0.5, "verification": 0.5},
        }
        score = KyaScore.from_dict(data)
        assert score.score == 55.0
        assert score.dimensions.behavioral == 0.5

    def test_from_dict_missing_optional(self) -> None:
        data = {"handle": "min-agent", "score": 0.0, "trust_tier": 0, "dimensions": {}}
        score = KyaScore.from_dict(data)
        assert score.reputation is None
        assert score.updated_at is None


class TestKyaCard:
    def test_from_dict_full(self) -> None:
        data = {
            "handle": "card-agent",
            "display_name": "Card Agent",
            "trust_tier": 4,
            "score": 88.0,
            "bio": "A bio",
            "avatar_url": "https://example.com/avatar.png",
            "accent_color": "#ff0000",
            "tagline": "Testing!",
            "flair_tags": ["verified", "active"],
            "extra_field": "extra_value",
        }
        card = KyaCard.from_dict(data)
        assert card.handle == "card-agent"
        assert card.display_name == "Card Agent"
        assert card.trust_tier == 4
        assert card.flair_tags == ["verified", "active"]
        assert card.extra.get("extra_field") == "extra_value"

    def test_from_dict_minimal(self) -> None:
        card = KyaCard.from_dict({"handle": "min"})
        assert card.handle == "min"
        assert card.trust_tier is None
        assert card.flair_tags == []
        assert card.extra == {}


class TestKyaBadge:
    def test_from_dict(self) -> None:
        data = {
            "id": "award-1",
            "badge_id": "badge-pioneer",
            "slug": "pioneer",
            "name": "Pioneer",
            "description": "Early adopter",
            "icon_url": "https://example.com/badge.png",
            "voltage_reward": 100,
            "awarded_at": "2026-01-01T00:00:00Z",
        }
        badge = KyaBadge.from_dict(data)
        assert badge.id == "award-1"
        assert badge.slug == "pioneer"
        assert badge.voltage_reward == 100

    def test_from_dict_minimal(self) -> None:
        badge = KyaBadge.from_dict(
            {"id": "", "badge_id": "", "slug": "x", "name": "X", "description": ""}
        )
        assert badge.voltage_reward == 0
        assert badge.icon_url is None


class TestKyaDiscovery:
    def test_from_dict(self) -> None:
        data = {
            "version": "1.0",
            "endpoint": "https://pheme.ca/api/v1",
            "features": ["scoring", "badges"],
            "schema_url": "https://pheme.ca/kya-schema.json",
        }
        disc = KyaDiscovery.from_dict(data)
        assert disc.version == "1.0"
        assert disc.endpoint == "https://pheme.ca/api/v1"
        assert "scoring" in disc.features
        assert disc.extra.get("schema_url") == "https://pheme.ca/kya-schema.json"


class TestAgentCatalog:
    def test_from_dict_with_agents_key(self) -> None:
        data = {
            "agents": [
                {"handle": "agent-a", "trust_tier": 3},
                {"handle": "agent-b", "trust_tier": 2},
            ]
        }
        catalog = AgentCatalog.from_dict(data)
        assert len(catalog.agents) == 2
        assert catalog.agents[0].handle == "agent-a"
        assert catalog.agents[1].trust_tier == 2

    def test_from_dict_empty(self) -> None:
        catalog = AgentCatalog.from_dict({})
        assert catalog.agents == []


class TestAgentCatalogEntry:
    def test_from_dict(self) -> None:
        data = {"handle": "foo", "trust_tier": 5, "display_name": "Foo Agent", "extra": "bar"}
        entry = AgentCatalogEntry.from_dict(data)
        assert entry.handle == "foo"
        assert entry.trust_tier == 5
        assert entry.extra.get("extra") == "bar"
