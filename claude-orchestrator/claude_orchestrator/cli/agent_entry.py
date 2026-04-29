"""CLI entry point for agent.py — thin coordinator, exits with correct codes."""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import IO

logger = logging.getLogger(__name__)


def agent_main(argv: list[str], stdin_stream: IO) -> int:
    """Parse args + stdin, build orchestrator, run, return exit code."""
    if len(argv) < 2:
        print("Usage: agent.py <agent-name>", file=sys.stderr)
        return 1

    agent_name = argv[1]

    try:
        raw = json.load(stdin_stream)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON on stdin: %s", exc)
        return 1

    from claude_orchestrator.agent_catalog.loader import AgentRegistry
    from claude_orchestrator.cli.config import find_project_root, is_verbose
    from claude_orchestrator.domain import RuneContext
    from claude_orchestrator.hook_runner import HookRunner
    from claude_orchestrator.orchestrator import RuneOrchestrator
    from claude_orchestrator.reporting import BifrostAPIClient
    from claude_orchestrator.sdk_runner import SDKRunner
    from claude_orchestrator._rune_types import Rune

    rune = Rune.from_dict(raw.get("rune") or {})
    cwd = raw.get("cwd") or find_project_root()
    context = RuneContext(rune=rune, cwd=cwd)

    registry = AgentRegistry()
    registry.load_all()

    entry = registry.get(agent_name)
    if entry is None:
        logger.error(
            "Unknown agent: %r (available: %s)",
            agent_name,
            list(registry.all().keys()),
        )
        return 1

    if not entry.definition.model:
        logger.error(
            "Agent %r has no model declared; add 'model:' to its frontmatter",
            agent_name,
        )
        return 1

    verbose = is_verbose()
    api_url = os.environ.get("BIFROST_API_URL", "http://localhost:8000")

    hook_runner = HookRunner(project_dir=cwd)
    sdk_runner = SDKRunner(entry=entry, context=context, verbose=verbose)
    api_client = BifrostAPIClient(base_url=api_url)

    orchestrator = RuneOrchestrator(
        context=context,
        entry=entry,
        hook_runner=hook_runner,
        sdk_runner=sdk_runner,
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
