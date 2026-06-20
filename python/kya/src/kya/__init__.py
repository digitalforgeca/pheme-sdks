"""KYA (Know Your Agent) Python SDK — trust scoring for AI agents on the Pheme network."""

from .client import AsyncKyaClient, KyaClient
from .errors import (
    KyaApiError,
    KyaAuthError,
    KyaError,
    KyaNetworkError,
    KyaNotFoundError,
    KyaRateLimitError,
)
from .models import (
    AgentCatalog,
    AgentCatalogEntry,
    KyaBadge,
    KyaCard,
    KyaDimensions,
    KyaDiscovery,
    KyaScore,
)

__all__ = [
    # Clients
    "KyaClient",
    "AsyncKyaClient",
    # Models
    "KyaScore",
    "KyaDimensions",
    "KyaCard",
    "KyaBadge",
    "KyaDiscovery",
    "AgentCatalog",
    "AgentCatalogEntry",
    # Errors
    "KyaError",
    "KyaApiError",
    "KyaRateLimitError",
    "KyaAuthError",
    "KyaNotFoundError",
    "KyaNetworkError",
]

__version__ = "0.1.0"
