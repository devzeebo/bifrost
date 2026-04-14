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

# ANSI color codes for worker prefixes — cycle through these per worker ID
_WORKER_COLORS = [
    "\033[36m",   # cyan
    "\033[33m",   # yellow
    "\033[35m",   # magenta
    "\033[32m",   # green
    "\033[34m",   # blue
    "\033[91m",   # bright red
    "\033[96m",   # bright cyan
    "\033[93m",   # bright yellow
]
_COLOR_RESET = "\033[0m"
_COLOR_BOLD = "\033[1m"

# Map worker IDs to a stable color
_worker_color_cache: dict[str, str] = {}
_worker_color_counter = 0


def _worker_color(worker_id: str) -> str:
    global _worker_color_counter
    if worker_id not in _worker_color_cache:
        color = _WORKER_COLORS[_worker_color_counter % len(_WORKER_COLORS)]
        _worker_color_cache[worker_id] = color
        _worker_color_counter += 1
    return _worker_color_cache[worker_id]


def _worker_prefix(worker_id: str) -> str:
    color = _worker_color(worker_id)
    return f"{_COLOR_BOLD}{color}worker-{worker_id}{_COLOR_RESET}"


def _is_verbose() -> bool:
    """Read orchestrate.logging from .bifrost.yaml in project root."""
    try:
        import yaml
        root = _find_project_root()
        config_path = Path(root) / ".bifrost.yaml"
        if not config_path.exists():
            return False
        config = yaml.safe_load(config_path.read_text())
        orchestrate = config.get("orchestrate") or {}
        return orchestrate.get("logging") == "verbose"
    except Exception:
        return False


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
    rune_id = rune.get("id", "unknown")
    verbose = _is_verbose()

    logger.info("Running agent %r in %s for rune %s", agent_name, cwd, rune_id)

    prompt = _build_prompt(rune)

    import anyio
    anyio.run(_run_agent, agent_name, agent_def, prompt, cwd, rune_id, verbose)


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


def _log_verbose(worker_id: str, msg: str) -> None:
    prefix = _worker_prefix(worker_id)
    print(f"{prefix}: {msg}", file=sys.stderr)


async def _run_agent(
    agent_name: str,
    agent_def,
    prompt: str,
    cwd: str,
    rune_id: str,
    verbose: bool,
) -> None:
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        ResultMessage,
        TextBlock,
        ToolUseBlock,
        query,
    )

    options = ClaudeAgentOptions(
        cwd=cwd,
        allowed_tools=agent_def.tools or ["Read", "Bash", "Glob", "Grep"],
        permission_mode="bypassPermissions",
        system_prompt=agent_def.prompt,
        setting_sources=["project"],
    )

    if verbose:
        _log_verbose(rune_id, f"starting agent={agent_name}")

    got_result = False
    async for message in query(prompt=prompt, options=options):
        if verbose:
            _log_verbose_message(rune_id, message, AssistantMessage, TextBlock, ToolUseBlock)
        if isinstance(message, ResultMessage):
            if verbose:
                cost = f"  cost=${message.total_cost_usd:.4f}" if message.total_cost_usd is not None else ""
                _log_verbose(rune_id, f"done turns={message.num_turns}{cost}")
            else:
                logger.info("Agent %r completed: %s", agent_name, (message.result or "")[:200])
            got_result = True
            break

    if not got_result:
        logger.error("Agent %r produced no ResultMessage", agent_name)
        sys.exit(1)


def _log_verbose_message(rune_id: str, message: object, AssistantMessage, TextBlock, ToolUseBlock) -> None:  # noqa: N803
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock) and block.text.strip():
                # Truncate long text, show first line only
                first_line = block.text.strip().splitlines()[0][:120]
                _log_verbose(rune_id, f"text: {first_line}")
            elif isinstance(block, ToolUseBlock):
                # Show tool name + key input fields
                inp = block.input or {}
                inp_summary = ", ".join(f"{k}={str(v)[:60]}" for k, v in list(inp.items())[:3])
                _log_verbose(rune_id, f"tool: {block.name}({inp_summary})")


def _find_project_root() -> str:
    """Walk up from cwd to find .bifrost.yaml or .git."""
    path = Path(os.getcwd())
    for candidate in [path, *path.parents]:
        if (candidate / ".bifrost.yaml").exists() or (candidate / ".git").exists():
            return str(candidate)
    return str(path)


if __name__ == "__main__":
    main()
