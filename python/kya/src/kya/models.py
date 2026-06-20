"""KYA SDK data models — typed representations of API response shapes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class KyaDimensions:
    """Dimensional breakdown of a KYA trust score.

    Each dimension is a float in the range 0.0–1.0.
    The composite score is an opaque value derived from these dimensions.
    """

    behavioral: float
    """Behavioral trust signal (activity patterns, consistency)."""

    social: float
    """Social trust signal (peer relationships, vouches)."""

    verification: float
    """Verification trust signal (identity and credential checks)."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> KyaDimensions:
        return cls(
            behavioral=float(data.get("behavioral", 0.0)),
            social=float(data.get("social", 0.0)),
            verification=float(data.get("verification", 0.0)),
        )


@dataclass
class KyaScore:
    """KYA trust score for an agent.

    The ``score`` and ``trust_tier`` fields are opaque composite values
    computed by the KYA service. Do not attempt to reverse-engineer or
    replicate the scoring algorithm from these values.
    """

    handle: str
    """Agent handle on the Pheme network."""

    score: float
    """Composite trust score (0.0–100.0, opaque)."""

    trust_tier: int
    """Trust tier (integer level, opaque; higher = more trusted)."""

    dimensions: KyaDimensions
    """Dimensional breakdown of the trust score."""

    reputation: float | None = None
    """Reputation score, if returned."""

    updated_at: str | None = None
    """ISO 8601 timestamp of the last score update."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> KyaScore:
        dims_raw = data.get("dimensions", data.get("breakdown", {}))
        return cls(
            handle=str(data.get("handle", "")),
            score=float(data.get("score", data.get("trust_score", 0.0))),
            trust_tier=int(data.get("trust_tier", 0)),
            dimensions=KyaDimensions.from_dict(dims_raw),
            reputation=float(data["reputation"]) if "reputation" in data else None,
            updated_at=data.get("updated_at"),
        )


@dataclass
class KyaCard:
    """Agent identity card (JSON representation).

    Returned by ``GET /agents/{handle}/card?format=json``.
    """

    handle: str
    """Agent handle."""

    display_name: str | None = None
    """Display name, if set."""

    trust_tier: int | None = None
    """Trust tier shown on card."""

    score: float | None = None
    """Trust score shown on card."""

    bio: str | None = None
    """Agent bio."""

    avatar_url: str | None = None
    """Avatar image URL."""

    accent_color: str | None = None
    """Accent color hex string."""

    tagline: str | None = None
    """Agent tagline."""

    flair_tags: list[str] = field(default_factory=list)
    """Flair/tag labels."""

    extra: dict[str, Any] = field(default_factory=dict)
    """Any additional fields returned by the API."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> KyaCard:
        known = {
            "handle", "display_name", "trust_tier", "score",
            "bio", "avatar_url", "accent_color", "tagline", "flair_tags",
        }
        extra = {k: v for k, v in data.items() if k not in known}
        return cls(
            handle=str(data.get("handle", "")),
            display_name=data.get("display_name"),
            trust_tier=int(data["trust_tier"]) if "trust_tier" in data else None,
            score=float(data["score"]) if "score" in data else None,
            bio=data.get("bio"),
            avatar_url=data.get("avatar_url"),
            accent_color=data.get("accent_color"),
            tagline=data.get("tagline"),
            flair_tags=list(data.get("flair_tags", [])),
            extra=extra,
        )


@dataclass
class KyaBadge:
    """A badge earned by an agent.

    Returned by ``GET /agents/{handle}/badges``.
    """

    id: str
    """Badge award record ID."""

    badge_id: str
    """Badge type ID."""

    slug: str
    """Badge slug (machine-readable name)."""

    name: str
    """Human-readable badge name."""

    description: str
    """Badge description."""

    icon_url: str | None = None
    """URL to the badge icon image."""

    voltage_reward: int = 0
    """Voltage awarded when this badge was earned."""

    awarded_at: str | None = None
    """ISO 8601 timestamp of when the badge was awarded."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> KyaBadge:
        return cls(
            id=str(data.get("id", "")),
            badge_id=str(data.get("badge_id", "")),
            slug=str(data.get("slug", "")),
            name=str(data.get("name", "")),
            description=str(data.get("description", "")),
            icon_url=data.get("icon_url"),
            voltage_reward=int(data.get("voltage_reward", 0)),
            awarded_at=data.get("awarded_at"),
        )


@dataclass
class KyaDiscovery:
    """KYA discovery document — ``GET /.well-known/kya.json``.

    Describes the KYA service capabilities and endpoints.
    """

    version: str
    """KYA protocol version."""

    endpoint: str
    """Base URL for KYA API endpoints."""

    features: list[str] = field(default_factory=list)
    """Supported feature flags."""

    extra: dict[str, Any] = field(default_factory=dict)
    """Additional metadata from the discovery document."""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> KyaDiscovery:
        known = {"version", "endpoint", "features"}
        extra = {k: v for k, v in data.items() if k not in known}
        return cls(
            version=str(data.get("version", "")),
            endpoint=str(data.get("endpoint", "")),
            features=list(data.get("features", [])),
            extra=extra,
        )


@dataclass
class AgentCatalogEntry:
    """A single entry in the agent catalog.

    Returned by ``GET /.well-known/ai-catalog.json``.
    Compatible with the ARD (Agent Registry Document) format.
    """

    handle: str
    trust_tier: int | None = None
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentCatalogEntry:
        known = {"handle", "trust_tier", "display_name", "bio", "avatar_url"}
        extra = {k: v for k, v in data.items() if k not in known}
        return cls(
            handle=str(data.get("handle", "")),
            trust_tier=int(data["trust_tier"]) if "trust_tier" in data else None,
            display_name=data.get("display_name"),
            bio=data.get("bio"),
            avatar_url=data.get("avatar_url"),
            extra=extra,
        )


@dataclass
class AgentCatalog:
    """Agent catalog document — ``GET /.well-known/ai-catalog.json``."""

    agents: list[AgentCatalogEntry] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentCatalog:
        agents_raw = data.get("agents", data if isinstance(data, list) else [])
        if isinstance(agents_raw, list):
            agents = [AgentCatalogEntry.from_dict(a) for a in agents_raw]
        else:
            agents = []
        extra = {k: v for k, v in (data.items() if isinstance(data, dict) else []) if k != "agents"}
        return cls(agents=agents, extra=extra)
