"""CLI entry point for agent.py — thin coordinator, exits with correct codes."""

from typing import TYPE_CHECKING, IO

import json
import logging
import os

if TYPE_CHECKING:
    from orchestrator.core.orchestrator import AgentEntry

logger = logging.getLogger(__name__)


def agent_main(argv: list[str], stdin_stream: IO) -> int:
    """Parse args + stdin, build orchestrator, run, return exit code."""
    if len(argv) < 2:
        print("Usage: agent.py <agent-name>", file=__import__("sys").stderr)
        return 1

    agent_name = argv[1]

    try:
        raw = json.load(stdin_stream)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON on stdin: %s", exc)
        return 1

    from orchestrator.cli.config import find_project_root, is_verbose
    from orchestrator.core.domain import RuneContext
    from orchestrator.core.hook_runner import HookRunner
    from orchestrator.core.orchestrator import RuneOrchestrator
    from orchestrator.core.reporting import BifrostAPIClient

    rune_data = raw.get("rune") or {}
    cwd = raw.get("cwd") or find_project_root()
    context = RuneContext(
        rune_id=rune_data.get("id", ""),
        title=rune_data.get("title", ""),
        description=rune_data.get("description"),
        cwd=cwd,
        tags=rune_data.get("tags", []),
        raw_detail=rune_data,
    )

    # For now, use a simple agent loader
    # TODO: integrate with agent catalog from engine-claude-code
    entry = _load_agent_entry(agent_name, cwd)
    if entry is None:
        logger.error("Unknown agent: %r", agent_name)
        return 1

    if not entry.model:
        logger.error("Agent %r has no model declared", agent_name)
        return 1

    verbose = is_verbose()
    api_url = os.environ.get("BIFROST_API_URL", "http://localhost:8000")

    hook_runner = HookRunner(project_dir=cwd)
    # TODO: initialize engine from engine-claude-code
    api_client = BifrostAPIClient(base_url=api_url)

    orchestrator = RuneOrchestrator(
        context=context,
        entry=entry,
        hook_runner=hook_runner,
        engine=None,  # TODO: pass engine instance
        api_client=api_client,
        verbose=verbose,
    )

    import anyio

    result = anyio.run(orchestrator.run)

    if not result.success:
        return 1
    if result.skip_fulfill:
        return -2
    return 0


def _load_agent_entry(agent_name: str, cwd: str) -> AgentEntry | None:
    """Load agent entry from agent catalog.

    TODO: This is a placeholder. Integrate with engine-claude-code agent catalog.
    """
    # Simple placeholder - in real implementation, this would use the agent catalog
    return AgentEntry(
        name=agent_name,
        model="sonnet",
        prompt="You are a helpful assistant.",
        tools=["Read", "Grep"],
    )
