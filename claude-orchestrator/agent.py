#!/usr/bin/env python3
"""
Bifrost agent runner.

Invoked by the CLI after dispatcher.py resolves a rune.
Receives:
  argv[1]: agent name (e.g. "decompose")
  stdin:   rune JSON (DispatchInput)

Loads the agent definition from agents/<name>.md via the registry,
runs RuneStart hooks, runs the Claude Agent SDK, then runs RuneStop hooks.

Exit 0 on success (CLI fulfills the rune).
Exit 1 on failure (CLI logs error, optionally unclaims).

RuneStart hooks:
  - Receive rune JSON on stdin
  - stdout is appended to the system prompt (all hooks concatenated in order)

RuneStop hooks (exit code convention mirrors Claude hooks):
  - 0: success — proceed to fulfill
  - 1: non-blocking — forward stdout to agent as a follow-up message, continue chat
  - 2: blocking — do NOT fulfill, leave rune claimed, log failure
"""

import json
import logging
import os
import subprocess
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

    entry = registry.get(agent_name)
    if entry is None:
        logger.error("Unknown agent: %r (available: %s)", agent_name, list(registry.all().keys()))
        sys.exit(1)

    agent_def = entry.definition
    hooks = entry.hooks

    if not agent_def.model:
        logger.error("Agent %r has no model declared; add 'model:' to its frontmatter", agent_name)
        sys.exit(1)

    cwd = _find_project_root()
    rune_id = rune.get("id", "unknown")
    verbose = _is_verbose()
    rune_json = json.dumps(rune)

    logger.info("Running agent %r in %s for rune %s", agent_name, cwd, rune_id)

    # --- RuneStart hooks ---
    extra_system_prompt = _run_rune_start_hooks(hooks.rune_start, rune_json, rune_id, cwd)

    system_prompt = agent_def.prompt
    if extra_system_prompt:
        system_prompt = system_prompt + "\n\n" + extra_system_prompt

    prompt = _build_prompt(rune)

    import anyio
    success = anyio.run(
        _run_agent,
        agent_name,
        agent_def,
        system_prompt,
        hooks.rune_stop,
        rune_json,
        prompt,
        cwd,
        rune_id,
        verbose,
    )

    if not success:
        sys.exit(1)


def _run_hook_command(command: str, rune_json: str, project_dir: str) -> subprocess.CompletedProcess:
    """Run a hook command with rune JSON on stdin, using shell for expansion."""
    env = os.environ.copy()
    env["CLAUDE_PROJECT_DIR"] = project_dir
    return subprocess.run(
        command,
        shell=True,
        input=rune_json,
        capture_output=True,
        text=True,
        env=env,
    )


def _run_rune_start_hooks(hook_commands, rune_json: str, rune_id: str, project_dir: str) -> str:
    """Run all RuneStart hook commands; return concatenated stdout."""
    parts: list[str] = []
    for hook in hook_commands:
        logger.info("Running RuneStart hook: %s", hook.command)
        try:
            result = _run_hook_command(hook.command, rune_json, project_dir)
            if result.returncode != 0:
                logger.warning(
                    "RuneStart hook exited %d: %s",
                    result.returncode,
                    result.stderr.strip(),
                )
            if result.stdout.strip():
                parts.append(result.stdout.strip())
        except Exception as exc:
            logger.warning("RuneStart hook failed: %s", exc)
    return "\n\n".join(parts)


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


def _log_verbose(worker_id: str, msg: str, elapsed_ms: int | None = None) -> None:
    prefix = _worker_prefix(worker_id)
    ts = f"\033[2m+{elapsed_ms}ms\033[0m " if elapsed_ms is not None else ""
    print(f"{prefix}: {ts}{msg}", file=sys.stderr)


async def _drain_messages(
    client,
    rune_id: str,
    agent_name: str,
    verbose: bool,
    *,
    start_ns: int,
) -> tuple[bool, int]:
    """
    Drain messages from client until a ResultMessage arrives.

    Returns (got_result, last_ns).
    """
    import time

    from claude_agent_sdk import (
        AssistantMessage,
        ResultMessage,
        TextBlock,
        ToolUseBlock,
    )

    last_ns = start_ns
    got_result = False

    async for message in client.receive_messages():
        now_ns = time.monotonic_ns()
        since_last_ms = (now_ns - last_ns) // 1_000_000
        last_ns = now_ns

        if verbose:
            _log_verbose_message(rune_id, message, AssistantMessage, TextBlock, ToolUseBlock, since_last_ms)
        if isinstance(message, ResultMessage):
            total_ms = (now_ns - start_ns) // 1_000_000
            usage = message.usage or {}
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            cache_read = usage.get("cache_read_input_tokens", 0)
            cache_write = usage.get("cache_creation_input_tokens", 0)
            cost = f"${message.total_cost_usd:.4f}" if message.total_cost_usd is not None else "n/a"
            if verbose:
                token_parts = [f"in={input_tokens}", f"out={output_tokens}"]
                if cache_read:
                    token_parts.append(f"cache_read={cache_read}")
                if cache_write:
                    token_parts.append(f"cache_write={cache_write}")
                _log_verbose(
                    rune_id,
                    f"done turns={message.num_turns} total={total_ms}ms"
                    f"  tokens={' '.join(token_parts)}  cost={cost}",
                )
            else:
                logger.info(
                    "Agent %r completed: turns=%d time=%dms tokens(in=%d out=%d) cost=%s — %s",
                    agent_name, message.num_turns, total_ms,
                    input_tokens, output_tokens, cost,
                    (message.result or "")[:200],
                )
            got_result = True
            break

    return got_result, last_ns


async def _run_agent(
    agent_name: str,
    agent_def,
    system_prompt: str,
    rune_stop_hooks: list,
    rune_json: str,
    prompt: str,
    cwd: str,
    rune_id: str,
    verbose: bool,
) -> bool:
    """Run agent, then RuneStop hooks. Returns True if rune should be fulfilled."""
    import time

    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

    options = ClaudeAgentOptions(
        cwd=cwd,
        allowed_tools=agent_def.tools or ["Read", "Bash", "Glob", "Grep"],
        permission_mode="bypassPermissions",
        system_prompt=system_prompt,
        model=agent_def.model,
        setting_sources=["project"],
    )

    start_ns = time.monotonic_ns()

    if verbose:
        _log_verbose(rune_id, f"starting agent={agent_name} model={agent_def.model}", elapsed_ms=0)

    async with ClaudeSDKClient(options=options) as client:
        # __aenter__ called connect() with empty stream; send initial prompt now
        await client.query(prompt)

        got_result, last_ns = await _drain_messages(
            client, rune_id, agent_name, verbose, start_ns=start_ns
        )

        if not got_result:
            logger.error("Agent %r produced no ResultMessage", agent_name)
            return False

        # --- RuneStop hooks ---
        for hook in rune_stop_hooks:
            logger.info("Running RuneStop hook: %s", hook.command)
            try:
                result = _run_hook_command(hook.command, rune_json, cwd)
            except Exception as exc:
                logger.warning("RuneStop hook failed to execute: %s", exc)
                continue

            if result.returncode == 0:
                # Success — continue to next hook
                continue

            if result.returncode == 1:
                # Non-blocking: forward stdout back to agent as a follow-up message
                hook_output = result.stdout.strip()
                if not hook_output:
                    hook_output = result.stderr.strip()
                follow_up = (
                    f"A post-completion hook reported an issue and provided "
                    f"additional context. Please review and address it:\n\n{hook_output}"
                )
                logger.info("RuneStop hook exited 1; sending follow-up to agent")
                await client.query(follow_up)
                cont_result, last_ns = await _drain_messages(
                    client, rune_id, agent_name, verbose, start_ns=last_ns
                )
                if not cont_result:
                    logger.error(
                        "Agent %r produced no ResultMessage after hook follow-up", agent_name
                    )
                    return False

            elif result.returncode == 2:
                # Blocking: do NOT fulfill, leave rune claimed
                hook_output = result.stderr.strip() or result.stdout.strip()
                logger.error(
                    "RuneStop hook blocked fulfillment (exit 2): %s",
                    hook_output,
                )
                return False

            else:
                # Unknown exit code — treat as non-fatal warning
                logger.warning(
                    "RuneStop hook exited %d (unexpected); continuing",
                    result.returncode,
                )

    return True


def _log_verbose_message(rune_id: str, message: object, AssistantMessage, TextBlock, ToolUseBlock, elapsed_ms: int) -> None:  # noqa: N803
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock) and block.text.strip():
                first_line = block.text.strip().splitlines()[0][:120]
                _log_verbose(rune_id, f"text: {first_line}", elapsed_ms=elapsed_ms)
            elif isinstance(block, ToolUseBlock):
                inp = block.input or {}
                inp_summary = ", ".join(f"{k}={str(v)[:60]}" for k, v in list(inp.items())[:3])
                _log_verbose(rune_id, f"tool: {block.name}({inp_summary})", elapsed_ms=elapsed_ms)


def _find_project_root() -> str:
    """Walk up from cwd to find .bifrost.yaml or .git."""
    path = Path(os.getcwd())
    for candidate in [path, *path.parents]:
        if (candidate / ".bifrost.yaml").exists() or (candidate / ".git").exists():
            return str(candidate)
    return str(path)


if __name__ == "__main__":
    main()
