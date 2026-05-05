"""Base configuration types for task sources."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class BaseTaskSourceConfig:
    """Base configuration for task sources.

    Subclasses should extend this with plugin-specific settings.
    """

    settings: dict[str, Any] = field(default_factory=dict)
