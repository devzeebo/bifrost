"""Configuration management from .bifrost.yaml."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class TaskSourceConfig:
    """Configuration for task sources."""

    type: str  # e.g., "bifrost", "github"
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EngineConfig:
    """Configuration for engines."""

    type: str  # e.g., "claude-code", "generic"
    settings: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class OrchestratorConfig:
    """Full orchestrator configuration from .bifrost.yaml."""

    task_source: TaskSourceConfig
    engine: EngineConfig
    concurrency: int = 1
    claimant: str | None = None
    dispatcher: str | None = None


def load_config(project_dir: str | None = None) -> OrchestratorConfig:
    """Load orchestrator configuration from .bifrost.yaml.

    Args:
        project_dir: Project directory to search for .bifrost.yaml.
                    Defaults to current working directory.

    Returns:
        OrchestratorConfig with defaults for missing values
    """
    import yaml

    if project_dir is None:
        project_dir = _find_project_root()

    config_path = Path(project_dir) / ".bifrost.yaml"
    if not config_path.exists():
        return _default_config()

    try:
        data = yaml.safe_load(config_path.read_text()) or {}
    except Exception:
        return _default_config()

    orchestrate = data.get("orchestrate") or {}

    # Parse task_source config
    task_source_raw = orchestrate.get("task_source") or {}
    task_source = TaskSourceConfig(
        type=task_source_raw.get("type", "bifrost"),
        settings=task_source_raw.get("settings") or {},
    )

    # Parse engine config
    engine_raw = orchestrate.get("engine") or {}
    engine = EngineConfig(
        type=engine_raw.get("type", "claude-code"),
        settings=engine_raw.get("settings") or {},
    )

    return OrchestratorConfig(
        task_source=task_source,
        engine=engine,
        concurrency=orchestrate.get("concurrency", 1),
        claimant=orchestrate.get("claimant"),
        dispatcher=orchestrate.get("dispatcher"),
    )


def _find_project_root() -> str:
    """Walk up from cwd to find .bifrost.yaml or .git."""
    import os

    path = Path(os.getcwd())
    for candidate in [path, *path.parents]:
        if (candidate / ".bifrost.yaml").exists() or (candidate / ".git").exists():
            return str(candidate)
    return str(path)


def _default_config() -> OrchestratorConfig:
    """Return default configuration when no .bifrost.yaml is found."""
    return OrchestratorConfig(
        task_source=TaskSourceConfig(type="bifrost", settings={}),
        engine=EngineConfig(type="claude-code", settings={}),
        concurrency=1,
        claimant=None,
        dispatcher=None,
    )
