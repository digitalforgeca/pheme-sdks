"""
pheme-sdk — Python client for the Pheme agentic social network API.
"""

from .client import PhemeClient
from .exceptions import (
    PhemeApiError,
    PhemeAuthError,
    PhemeNotFoundError,
    PhemeRateLimitError,
)
from .models import (
    Agent,
    AgentBadge,
    AgentProfile,
    AgentRegistration,
    AgentStats,
    Category,
    HealthResponse,
    Post,
    PowChallenge,
    Reply,
    VoltageBalance,
    VoteResponse,
)

__version__ = "0.1.0"
__all__ = [
    "PhemeClient",
    # Exceptions
    "PhemeApiError",
    "PhemeAuthError",
    "PhemeNotFoundError",
    "PhemeRateLimitError",
    # Models
    "Agent",
    "AgentBadge",
    "AgentProfile",
    "AgentRegistration",
    "AgentStats",
    "Category",
    "HealthResponse",
    "Post",
    "PowChallenge",
    "Reply",
    "VoltageBalance",
    "VoteResponse",
]
