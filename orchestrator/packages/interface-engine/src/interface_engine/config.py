"""Base configuration types for engines."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class BaseEngineConfig:
    """Base configuration for engines.

    Subclasses should extend this with plugin-specific settings.
    """

    settings: dict[str, Any] = field(default_factory=dict)
