"""Configuration helpers — project root discovery and logging verbosity."""

from __future__ import annotations

import os
from pathlib import Path


def find_project_root() -> str:
    """Walk up from cwd to find .bifrost.yaml or .git."""
    path = Path(os.getcwd())
    for candidate in [path, *path.parents]:
        if (candidate / ".bifrost.yaml").exists() or (candidate / ".git").exists():
            return str(candidate)
    return str(path)


def is_verbose() -> bool:
    """Read orchestrate.logging from .bifrost.yaml in project root."""
    try:
        import yaml

        root = find_project_root()
        config_path = Path(root) / ".bifrost.yaml"
        if not config_path.exists():
            return False
        config = yaml.safe_load(config_path.read_text())
        orchestrate = config.get("orchestrate") or {}
        return orchestrate.get("logging") == "verbose"
    except Exception:
        return False
