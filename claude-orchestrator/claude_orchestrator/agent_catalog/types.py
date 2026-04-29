"""Agent catalog value objects."""

from __future__ import annotations

from dataclasses import dataclass
from typing import NamedTuple

from claude_agent_sdk import AgentDefinition


class HookSpec(NamedTuple):
    """A single hook command entry."""

    command: str


class AgentHooks(NamedTuple):
    """Hook commands attached to an agent, keyed by event name."""

    rune_start: list[HookSpec]
    rune_stop: list[HookSpec]


@dataclass
class AgentEntry:
    """Bundled agent definition and its rune hooks."""

    definition: AgentDefinition
    hooks: AgentHooks
