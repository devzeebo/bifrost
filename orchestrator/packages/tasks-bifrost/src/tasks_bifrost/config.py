"""Configuration for Bifrost task source."""

from dataclasses import dataclass
from interface_tasks.config import BaseTaskSourceConfig


@dataclass(frozen=True)
class BifrostTaskSourceConfig(BaseTaskSourceConfig):
    """Configuration for Bifrost API task source."""

    base_url: str = "http://localhost:8000"
    timeout: int = 30
    poll_interval: int = 10

    @classmethod
    def from_dict(cls, data: dict) -> "BifrostTaskSourceConfig":
        """Create config from dictionary (e.g., parsed YAML settings)."""
        settings = data.get("settings") or {}
        return cls(
            settings=data.get("settings", {}),
            base_url=settings.get("base_url", "http://localhost:8000"),
            timeout=settings.get("timeout", 30),
            poll_interval=settings.get("poll_interval", 10),
        )
