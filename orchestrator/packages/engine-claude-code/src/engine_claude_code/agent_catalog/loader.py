"""Agent registry — loads and caches agent definitions from .md files."""

import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path

from engine_claude_code.agent_catalog.parser import parse_agent_file
from engine_claude_code.agent_catalog.types import AgentEntry

logger = logging.getLogger(__name__)

# Default agents directories
CLAUDE_AGENTS_DIR = Path.home() / ".claude" / "agents"


@dataclass
class AgentRegistry:
    """Registry for agent definitions."""

    _agents: dict[str, AgentEntry] = field(default_factory=dict)
    _lock: threading.RLock = field(default_factory=threading.RLock)
    _watcher: object = field(default=None)
    _agents_dirs: list[Path] = field(default_factory=list)

    def __init__(self, agents_dirs: list[Path] | None = None) -> None:
        """Initialize the registry with custom agents directories.

        Args:
            agents_dirs: List of directories to search for agent .md files.
                        Defaults to [CLAUDE_AGENTS_DIR].
        """
        self._agents_dirs = agents_dirs or [CLAUDE_AGENTS_DIR]

    def load_all(self) -> None:
        """Load all agent .md files from the agents directories."""
        loaded = {}
        for search_dir in self._agents_dirs:
            if not search_dir.exists():
                continue
            for path in search_dir.glob("*.md"):
                try:
                    name, entry = parse_agent_file(path)
                    loaded[name] = entry
                    logger.debug("Loaded agent %r from %s", name, path)
                except Exception as exc:
                    logger.warning("Failed to load agent from %s: %s", path, exc)
        with self._lock:
            self._agents = loaded
        logger.info("Loaded %d agent(s): %s", len(loaded), list(loaded.keys()))

    def get(self, name: str) -> AgentEntry | None:
        """Get an agent entry by name."""
        with self._lock:
            return self._agents.get(name)

    def all(self) -> dict[str, AgentEntry]:
        """Get all registered agents."""
        with self._lock:
            return dict(self._agents)

    def start_watcher(self) -> None:
        """Watch agents dirs for changes; reload on modify/create/delete."""
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
        for watch_dir in self._agents_dirs:
            if watch_dir.exists():
                observer.schedule(_Handler(), str(watch_dir), recursive=False)
        observer.daemon = True
        observer.start()
        self._watcher = observer
        logger.info("Watching %s for agent changes", self._agents_dirs)

    def stop_watcher(self) -> None:
        """Stop the file watcher if running."""
        if self._watcher is not None:
            self._watcher.stop()
            self._watcher.join()
            self._watcher = None
