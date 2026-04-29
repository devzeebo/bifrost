"""Parse agent markdown files into AgentEntry objects."""

from __future__ import annotations

import re
from pathlib import Path

import yaml
from claude_agent_sdk import AgentDefinition

from claude_orchestrator.agent_catalog.types import AgentEntry, AgentHooks, HookSpec

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_agent_file(path: Path) -> tuple[str, AgentEntry]:
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


def _extract_hook_commands(event_block: object) -> list[HookSpec]:
    """Extract HookSpec list from a hooks event block."""
    if not isinstance(event_block, list):
        return []
    commands: list[HookSpec] = []
    for matcher_entry in event_block:
        if not isinstance(matcher_entry, dict):
            continue
        for hook in matcher_entry.get("hooks") or []:
            if not isinstance(hook, dict):
                continue
            if hook.get("type") == "command" and hook.get("command"):
                commands.append(HookSpec(command=hook["command"]))
    return commands
