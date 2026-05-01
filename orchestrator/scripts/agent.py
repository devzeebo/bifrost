#!/usr/bin/env python3
"""
Agent entry point script.

Orchestrates task execution: hooks → engine → follow-up loop.
Exits with code 0 (success), -2 (skip fulfill), or 1 (failure).
"""

import json
import logging
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> int:
    """Main entry point for agent execution."""
    if len(sys.argv) < 2:
        print("Usage: agent.py <agent-name>", file=sys.stderr)
        return 1

    agent_name = sys.argv[1]

    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON on stdin: %s", exc)
        return 1

    # Import orchestrator components
    from engine_claude_code.agent_catalog.loader import AgentRegistry
    from orchestrator.cli.config import find_project_root, is_verbose
    from orchestrator.core.domain import RuneContext
    from orchestrator.core.hook_runner import HookRunner, HookSpec
    from orchestrator.core.orchestrator import AgentEntry, RuneOrchestrator
    from orchestrator.core.reporting import BifrostAPIClient
    from engine_claude_code.sdk_runner import ClaudeCodeEngine

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

    # Load agent from catalog
    registry = AgentRegistry()
    registry.load_all()

    catalog_entry = registry.get(agent_name)
    if catalog_entry is None:
        logger.error(
            "Unknown agent: %r (available: %s)",
            agent_name,
            list(registry.all().keys()),
        )
        return 1

    if not catalog_entry.definition.model:
        logger.error(
            "Agent %r has no model declared; add 'model:' to its frontmatter",
            agent_name,
        )
        return 1

    # Convert catalog entry to orchestrator AgentEntry
    hook_specs = HookSpec

    entry = AgentEntry(
        name=agent_name,
        model=catalog_entry.definition.model,
        prompt=catalog_entry.definition.prompt,
        tools=catalog_entry.definition.tools,
        rune_start_hooks=[
            hook_specs(command=h.command) for h in catalog_entry.hooks.rune_start
        ],
        rune_stop_hooks=[
            hook_specs(command=h.command) for h in catalog_entry.hooks.rune_stop
        ],
    )

    verbose = is_verbose()
    api_url = os.environ.get("BIFROST_API_URL", "http://localhost:8000")

    hook_runner = HookRunner(project_dir=cwd)
    engine = ClaudeCodeEngine(entry=catalog_entry, verbose=verbose)
    api_client = BifrostAPIClient(base_url=api_url)

    orchestrator = RuneOrchestrator(
        context=context,
        entry=entry,
        hook_runner=hook_runner,
        engine=engine,
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


if __name__ == "__main__":
    sys.exit(main())
