"""
Loads agent definitions from markdown files in the agents directory.
Frontmatter fields: name, description, tools, model, hooks
Body: system prompt

Hooks follow the Claude sub-agent frontmatter format:

  hooks:
    RuneStart:
      - matcher: ""
        hooks:
          - type: command
            command: "./script.sh"
    RuneStop:
      - matcher: ""
        hooks:
          - type: command
            command: "./script.sh"

RuneStart hook commands receive rune JSON on stdin; stdout is appended to the system prompt.
RuneStop hook commands receive rune JSON on stdin; exit codes follow Claude hook conventions:
  0 = success, proceed to fulfill
  1 = non-blocking: forward stdout to agent as a follow-up message, continue chat
  2 = blocking: do NOT fulfill, leave rune claimed, log failure
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import NamedTuple

import yaml
from claude_agent_sdk import AgentDefinition

logger = logging.getLogger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


class HookCommand(NamedTuple):
    """A single hook command entry."""
    command: str


class AgentHooks(NamedTuple):
    """Hook commands attached to an agent, keyed by event name."""
    rune_start: list[HookCommand]  # run before agent; stdout appended to system prompt
    rune_stop: list[HookCommand]   # run after agent; exit code controls fulfillment


AGENTS_DIR = Path(__file__).parent
CLAUDE_AGENTS_DIR = Path.home() / ".claude" / "agents"


@dataclass
class AgentEntry:
    """Bundled agent definition and its rune hooks."""
    definition: AgentDefinition
    hooks: AgentHooks


@dataclass
class AgentRegistry:
    _agents: dict[str, AgentEntry] = field(default_factory=dict)
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
                    name, entry = _parse_agent_file(path)
                    loaded[name] = entry
                    logger.debug("Loaded agent %r from %s", name, path)
                except Exception as exc:
                    logger.warning("Failed to load agent from %s: %s", path, exc)
        with self._lock:
            self._agents = loaded
        logger.info("Loaded %d agent(s): %s", len(loaded), list(loaded.keys()))

    def get(self, name: str) -> AgentEntry | None:
        with self._lock:
            return self._agents.get(name)

    def all(self) -> dict[str, AgentEntry]:
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


def _extract_hook_commands(event_block: object) -> list[HookCommand]:
    """
    Extract HookCommand list from a hooks event block.

    Expected shape:
      [{"matcher": "...", "hooks": [{"type": "command", "command": "..."}]}]
    """
    if not isinstance(event_block, list):
        return []
    commands: list[HookCommand] = []
    for matcher_entry in event_block:
        if not isinstance(matcher_entry, dict):
            continue
        for hook in matcher_entry.get("hooks") or []:
            if not isinstance(hook, dict):
                continue
            if hook.get("type") == "command" and hook.get("command"):
                commands.append(HookCommand(command=hook["command"]))
    return commands


def _parse_agent_file(path: Path) -> tuple[str, AgentEntry]:
    text = path.read_text(encoding="utf-8")

    m = _FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError(f"No YAML frontmatter found in {path.name}")

    frontmatter_text = m.group(1)
    body = text[m.end():].strip()

    fields: dict = yaml.safe_load(frontmatter_text) or {}

    name = fields.get("name") or path.stem
    description = fields.get("description") or ""
    model = fields.get("model") or None

    tools_raw = fields.get("tools") or ""
    if isinstance(tools_raw, list):
        tools = [t.strip() for t in tools_raw if t] or None
    elif tools_raw:
        tools = [t.strip() for t in str(tools_raw).split(",") if t.strip()] or None
    else:
        tools = None

    hooks_block: dict = fields.get("hooks") or {}
    rune_start_hooks = _extract_hook_commands(hooks_block.get("RuneStart"))
    rune_stop_hooks = _extract_hook_commands(hooks_block.get("RuneStop"))

    return name, AgentEntry(
        definition=AgentDefinition(
            description=description,
            prompt=body,
            tools=tools,
            model=model,
        ),
        hooks=AgentHooks(
            rune_start=rune_start_hooks,
            rune_stop=rune_stop_hooks,
        ),
    )


# Module-level singleton
registry = AgentRegistry()
