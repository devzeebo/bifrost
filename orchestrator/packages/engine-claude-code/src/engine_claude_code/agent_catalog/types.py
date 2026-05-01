"""Agent catalog value objects."""

from dataclasses import dataclass
from typing import NamedTuple


class HookSpec(NamedTuple):
    """A single hook command entry."""

    command: str


class AgentHooks(NamedTuple):
    """Hook commands attached to an agent, keyed by event name."""

    rune_start: list[HookSpec]
    rune_stop: list[HookSpec]


@dataclass
class AgentDefinition:
    """Agent definition (prompt, tools, model)."""

    description: str
    prompt: str
    tools: list[str] | None
    model: str | None


@dataclass
class AgentEntry:
    """Bundled agent definition and its rune hooks."""

    definition: AgentDefinition
    hooks: AgentHooks
