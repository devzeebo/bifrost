"""
Loads agent definitions from markdown files in the agents directory.
Frontmatter fields: name, description, tools, model
Body: system prompt
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path

from claude_agent_sdk import AgentDefinition

logger = logging.getLogger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_FIELD_RE = re.compile(r"^(\w+)\s*:\s*(.+)$", re.MULTILINE)

AGENTS_DIR = Path(__file__).parent
CLAUDE_AGENTS_DIR = Path.home() / ".claude" / "agents"


@dataclass
class AgentRegistry:
    _agents: dict[str, AgentDefinition] = field(default_factory=dict)
    _lock: threading.RLock = field(default_factory=threading.RLock)
    _watcher: object = field(default=None)

    def load_all(self) -> None:
        """Load all agent .md files from the agents directory and ~/.claude/agents."""
        loaded = {}
        for search_dir in (AGENTS_DIR, CLAUDE_AGENTS_DIR):
            if not search_dir.exists():
                continue
            for path in search_dir.glob("*.md"):
                try:
                    name, defn = _parse_agent_file(path)
                    loaded[name] = defn
                    logger.debug("Loaded agent %r from %s", name, path)
                except Exception as exc:
                    logger.warning("Failed to load agent from %s: %s", path, exc)
        with self._lock:
            self._agents = loaded
        logger.info("Loaded %d agent(s): %s", len(loaded), list(loaded.keys()))

    def get(self, name: str) -> AgentDefinition | None:
        with self._lock:
            return self._agents.get(name)

    def all(self) -> dict[str, AgentDefinition]:
        with self._lock:
            return dict(self._agents)

    def start_watcher(self) -> None:
        """Watch agents dir for changes; reload on modify/create/delete."""
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer
        except ImportError:
            logger.warning("watchdog not installed; file watching disabled")
            return

        registry = self

        class _Handler(FileSystemEventHandler):
            def on_any_event(self, event):
                if event.is_directory:
                    return
                src = Path(getattr(event, "src_path", ""))
                dest = Path(getattr(event, "dest_path", ""))
                if src.suffix == ".md" or dest.suffix == ".md":
                    logger.info("Agent file changed (%s), reloading", event.event_type)
                    registry.load_all()

        observer = Observer()
        for watch_dir in (AGENTS_DIR, CLAUDE_AGENTS_DIR):
            if watch_dir.exists():
                observer.schedule(_Handler(), str(watch_dir), recursive=False)
        observer.daemon = True
        observer.start()
        self._watcher = observer
        logger.info("Watching %s and %s for agent changes", AGENTS_DIR, CLAUDE_AGENTS_DIR)

    def stop_watcher(self) -> None:
        if self._watcher is not None:
            self._watcher.stop()
            self._watcher.join()
            self._watcher = None


def _parse_agent_file(path: Path) -> tuple[str, AgentDefinition]:
    text = path.read_text(encoding="utf-8")

    m = _FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError(f"No YAML frontmatter found in {path.name}")

    frontmatter = m.group(1)
    body = text[m.end():].strip()

    fields: dict[str, str] = {}
    for fm, fv in _FIELD_RE.findall(frontmatter):
        fields[fm.strip().lower()] = fv.strip().strip('"').strip("'")

    name = fields.get("name") or path.stem
    description = fields.get("description", "")
    model = fields.get("model") or None

    tools_raw = fields.get("tools", "")
    tools = [t.strip() for t in tools_raw.split(",") if t.strip()] if tools_raw else None

    return name, AgentDefinition(
        description=description,
        prompt=body,
        tools=tools,
        model=model,
    )


# Module-level singleton
registry = AgentRegistry()
