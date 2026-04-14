#!/usr/bin/env python3
"""
Bifrost agent runner.

Invoked by the CLI after dispatcher.py resolves a rune.
Receives:
  argv[1]: agent name (e.g. "decompose")
  stdin:   rune JSON (DispatchInput)

Loads the agent definition from agents/<name>.md via the registry,
builds a prompt, and runs the Claude Agent SDK.

Exit 0 on success (CLI fulfills the rune).
Exit 1 on failure (CLI logs error, optionally unclaims).
"""

import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

# Ensure the orchestrator package is importable when run via uv
sys.path.insert(0, str(Path(__file__).parent))


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: agent.py <agent-name>", file=sys.stderr)
        sys.exit(1)

    agent_name = sys.argv[1]

    try:
        rune = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON on stdin: %s", exc)
        sys.exit(1)

    # Load agent registry (no watcher needed — single invocation)
    from agents.loader import registry
    registry.load_all()

    agent_def = registry.get(agent_name)
    if agent_def is None:
        logger.error("Unknown agent: %r (available: %s)", agent_name, list(registry.all().keys()))
        sys.exit(1)

    cwd = _find_project_root()
    logger.info("Running agent %r in %s for rune %s", agent_name, cwd, rune.get("id"))

    prompt = _build_prompt(rune)

    import anyio
    anyio.run(_run_agent, agent_name, agent_def, prompt, cwd)


def _build_prompt(rune: dict) -> str:
    lines = [
        f"Rune ID: {rune['id']}",
        f"Title: {rune['title']}",
    ]
    if rune.get("description"):
        lines += ["", "Description:", rune["description"]]
    if rune.get("notes"):
        lines += ["", "Notes:"]
        for note in rune["notes"]:
            if isinstance(note, dict) and note.get("text"):
                lines.append(f"  - {note['text']}")
    if rune.get("dependencies"):
        lines += ["", "Dependencies:"]
        for dep in rune["dependencies"]:
            if isinstance(dep, dict):
                lines.append(f"  - {dep.get('target_id')} ({dep.get('relationship')})")
    return "\n".join(lines)


async def _run_agent(agent_name: str, agent_def, prompt: str, cwd: str) -> None:
    from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

    options = ClaudeAgentOptions(
        cwd=cwd,
        allowed_tools=agent_def.tools or ["Read", "Bash", "Glob", "Grep"],
        permission_mode="bypassPermissions",
        system_prompt=agent_def.prompt,
        setting_sources=["project"],
    )

    got_result = False
    async for message in query(prompt=prompt, options=options):
        if isinstance(message, ResultMessage):
            logger.info("Agent %r completed: %s", agent_name, message.result[:200])
            got_result = True
            break

    if not got_result:
        logger.error("Agent %r produced no ResultMessage", agent_name)
        sys.exit(1)


def _find_project_root() -> str:
    """Walk up from cwd to find .bifrost.yaml or .git."""
    path = Path(os.getcwd())
    for candidate in [path, *path.parents]:
        if (candidate / ".bifrost.yaml").exists() or (candidate / ".git").exists():
            return str(candidate)
    return str(path)


if __name__ == "__main__":
    main()
