"""Configuration for Claude Code engine."""

from dataclasses import dataclass
from interface_engine.config import BaseEngineConfig


@dataclass(frozen=True)
class ClaudeCodeEngineConfig(BaseEngineConfig):
    """Configuration for Claude Code CLI engine."""

    claude_dir: str = "~/.claude"
    verbose: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> "ClaudeCodeEngineConfig":
        """Create config from dictionary (e.g., parsed YAML settings)."""
        settings = data.get("settings") or {}
        return cls(
            settings=data.get("settings", {}),
            claude_dir=settings.get("claude_dir", "~/.claude"),
            verbose=settings.get("verbose", False),
        )
