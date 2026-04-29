"""Backward-compat shim — logic lives in claude_orchestrator.agent_catalog."""

from claude_orchestrator.agent_catalog import AgentEntry, AgentHooks, AgentRegistry, registry
from claude_orchestrator.agent_catalog.types import HookSpec as HookCommand

__all__ = ["AgentRegistry", "AgentEntry", "AgentHooks", "HookCommand", "registry"]
