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
from contextvars import ContextVar
from pathlib import Path

from claude_agent_sdk import ClaudeSDKClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

# Context variable for test injection of mock clients
_test_client: ContextVar = ContextVar("_test_client", default=None)

# Ensure the orchestrator package is importable when run via uv
sys.path.insert(0, str(Path(__file__).parent))

# ANSI color codes for worker prefixes — cycle through these per worker ID
_WORKER_COLORS = [
    "\033[36m",  # cyan
    "\033[33m",  # yellow
    "\033[35m",  # magenta
    "\033[32m",  # green
    "\033[34m",  # blue
    "\033[91m",  # bright red
    "\033[96m",  # bright cyan
    "\033[93m",  # bright yellow
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
        logger.error(
            "Unknown agent: %r (available: %s)", agent_name, list(registry.all().keys())
        )
        sys.exit(1)

    agent_def = entry.definition
    hooks = entry.hooks

    if not agent_def.model:
        logger.error(
            "Agent %r has no model declared; add 'model:' to its frontmatter",
            agent_name,
        )
        sys.exit(1)

    # Extract cwd from rune if available, otherwise fall back to finding project root
    cwd = _find_project_root()
    rune_id = rune.get("id", "unknown")
    verbose = _is_verbose()
    rune_json = json.dumps(rune)

    logger.info("Running agent %r in %s for rune %s", agent_name, cwd, rune_id)

    # --- RuneStart hooks ---
    extra_system_prompt, skip_agent, hook_error = _run_rune_start_hooks(
        hooks.rune_start, rune_json, rune_id, cwd, None
    )

    # If RuneStart hook had a positive error, exit 1 (failure)
    if hook_error:
        logger.error("RuneStart hook reported error, exiting with failure")
        sys.exit(1)

    # If RuneStart hook said skip (-2), exit 0 (success, no agent)
    if skip_agent:
        logger.info("RuneStart hook signaled skip agent (-2), exiting successfully")
        sys.exit(0)

    system_prompt = agent_def.prompt
    if extra_system_prompt:
        system_prompt = system_prompt + "\n\n" + extra_system_prompt

    prompt = _build_prompt(rune)

    import anyio

    success, skip_fulfill = anyio.run(
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

    # If RuneStop hook said skip fulfill (-2), exit -2
    if skip_fulfill:
        logger.info("RuneStop hook signaled skip fulfill (-2), exiting with -2")
        sys.exit(-2)


def _log_hook(event: str, command: str, returncode: int, reason: str = "") -> None:
    """Emit a structured hook log line."""
    if returncode == 0:
        logger.info("hook:%s command=%s result=0", event, command)
    else:
        truncated = reason[:100] + ("..." if len(reason) > 100 else "")
        logger.warning(
            "hook:%s command=%s result=%d reason=%s",
            event,
            command,
            returncode,
            truncated,
        )


def _run_hook_command(
    command: str, rune_json: str, project_dir: str, last_agent_message: str | None = None
) -> subprocess.CompletedProcess:
    """Run a hook command with rune JSON on stdin, using shell for expansion."""
    env = os.environ.copy()
    env["CLAUDE_PROJECT_DIR"] = project_dir

    # Construct the JSON structure with rune, last_agent_message, and cwd
    hook_input = json.dumps({
        "rune": json.loads(rune_json),
        "last_agent_message": last_agent_message,
        "cwd": project_dir
    })

    return subprocess.run(
        command,
        shell=True,
        input=hook_input,
        capture_output=True,
        text=True,
        env=env,
        cwd=project_dir,
    )


def _run_rune_start_hooks(
    hook_commands, rune_json: str, rune_id: str, project_dir: str, last_agent_message: str | None = None
) -> tuple[str, bool, bool]:
    """
    Run all RuneStart hook commands; return (concatenated_stdout, skip_agent, error).

    If any hook exits -2, skip agent and return (output, True, False).
    If any hook exits with positive error (1, 2, etc.), return (output, False, True).
    Otherwise return (output, False, False).
    """
    parts: list[str] = []
    for hook in hook_commands:
        try:
            result = _run_hook_command(hook.command, rune_json, project_dir, last_agent_message)
            reason = (
                (result.stderr.strip() or result.stdout.strip())
                if result.returncode != 0
                else ""
            )
            _log_hook("RuneStart", hook.command, result.returncode, reason)

            # Exit -2 = skip agent, everything OK
            if result.returncode == -2:
                if result.stdout.strip():
                    parts.append(result.stdout.strip())
                return "\n\n".join(parts), True, False

            # Positive error code = failure, stop immediately
            if result.returncode > 0:
                if result.stdout.strip():
                    parts.append(result.stdout.strip())
                return "\n\n".join(parts), False, True

            if result.stdout.strip():
                parts.append(result.stdout.strip())
        except Exception as exc:
            logger.warning("hook:RuneStart command=%s failed: %s", hook.command, exc)
    return "\n\n".join(parts), False, False


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


def _log_claude_command(
    rune_id: str, model: str, tools: list[str] | None, verbose: bool
) -> None:
    """Log the effective claude invocation flags."""
    parts = ["claude", f"--model {model}", "--permission-mode dontAsk"]
    if tools:
        parts.append(f"--tools {','.join(tools)}")
        parts.append(f"--allowedTools {','.join(tools)}")
    cmd_str = " ".join(parts)
    if verbose:
        _log_verbose(rune_id, f"exec: {cmd_str}", elapsed_ms=0)
    else:
        logger.info("Starting agent: %s", cmd_str)


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
) -> tuple[bool, int, dict, str | None]:
    """
    Drain messages from client until a ResultMessage arrives.

    Returns (got_result, last_ns, stats_dict, last_assistant_message).
    """
    import time

    from claude_agent_sdk import (
        AssistantMessage,
        TextBlock,
        ToolUseBlock,
    )

    last_ns = start_ns
    got_result = False
    stats = {}
    last_assistant_message: str | None = None

    async for message in client.receive_messages():
        now_ns = time.monotonic_ns()
        since_last_ms = (now_ns - last_ns) // 1_000_000
        last_ns = now_ns

        # Capture the last assistant message
        message_type_name = type(message).__name__
        if message_type_name == "AssistantMessage":
            # Extract text content from the assistant message
            text_parts = []
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text') and block.text:
                        text_parts.append(block.text)
            last_assistant_message = "\n".join(text_parts) if text_parts else None

        if verbose:
            _log_verbose_message(
                rune_id,
                message,
                AssistantMessage,
                TextBlock,
                ToolUseBlock,
                since_last_ms,
            )
        # Check if this is a ResultMessage by type name only
        # This avoids any mock framework weirdness with isinstance
        if (
            message_type_name == "ResultMessage"
            or message_type_name == "MockResultMessage"
        ):
            total_ms = (now_ns - start_ns) // 1_000_000
            usage = message.usage or {}
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            cache_read = usage.get("cache_read_input_tokens", 0)
            cache_write = usage.get("cache_creation_input_tokens", 0)
            cost = (
                f"${message.total_cost_usd:.4f}"
                if message.total_cost_usd is not None
                else "n/a"
            )
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
                    agent_name,
                    message.num_turns,
                    total_ms,
                    input_tokens,
                    output_tokens,
                    cost,
                    (message.result or "")[:200],
                )
            stats = {
                "duration_ms": total_ms,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_read_tokens": cache_read,
                "cache_creation_tokens": cache_write,
                "total_cost_usd": message.total_cost_usd or 0.0,
                "num_turns": message.num_turns,
            }
            got_result = True
            break

    return got_result, last_ns, stats, last_assistant_message


async def _run_rune_stop_hooks(
    rune_stop_hooks: list,
    rune_json: str,
    cwd: str,
    client,
    rune_id: str,
    agent_name: str,
    verbose: bool,
    last_ns: int,
    last_agent_message: str | None,
) -> tuple[bool, int, bool]:
    """
    Run all RuneStop hooks, restarting from the first hook after any exit-1
    follow-up (so the agent's fix is verified by the full suite).

    Returns (passed, last_ns, skip_fulfill).
    skip_fulfill=True if any hook exits -2 (success but don't fulfill).
    """
    skip_fulfill = False
    while True:
        restarted = False
        for hook in rune_stop_hooks:
            try:
                result = _run_hook_command(hook.command, rune_json, cwd, last_agent_message)
            except Exception as exc:
                logger.warning("hook:RuneStop command=%s failed: %s", hook.command, exc)
                continue

            hook_output = result.stdout.strip() or result.stderr.strip()

            if result.returncode == 0:
                _log_hook("RuneStop", hook.command, 0)
                continue

            if result.returncode == -2:
                _log_hook("RuneStop", hook.command, -2, hook_output)
                skip_fulfill = True
                continue

            if result.returncode == 1:
                _log_hook("RuneStop", hook.command, 1, hook_output)
                follow_up = (
                    "A post-completion hook reported an issue and provided "
                    f"additional context. Please review and address it:\n\n{hook_output}"
                )
                await client.query(follow_up)
                cont_result, last_ns, _, last_assistant_message = await _drain_messages(
                    client, rune_id, agent_name, verbose, start_ns=last_ns
                )
                if not cont_result:
                    logger.error(
                        "Agent %r produced no ResultMessage after hook follow-up",
                        agent_name,
                    )
                    return False, last_ns, skip_fulfill
                # Update last_agent_message with the follow-up response
                last_agent_message = last_assistant_message
                # Restart all hooks from scratch to verify the fix
                restarted = True
                break

            elif result.returncode == 2:
                _log_hook("RuneStop", hook.command, 2, hook_output)
                return False, last_ns, skip_fulfill

            else:
                _log_hook("RuneStop", hook.command, result.returncode, hook_output)

        if not restarted:
            return True, last_ns, skip_fulfill


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
    _client_factory=None,  # For testing: inject mock client factory
) -> bool:
    """Run agent, then RuneStop hooks. Returns True if rune should be fulfilled."""
    import time

    from claude_agent_sdk import ClaudeAgentOptions

    options = ClaudeAgentOptions(
        cwd=cwd,
        tools=agent_def.tools,
        allowed_tools=agent_def.tools,
        permission_mode="dontAsk",
        system_prompt=system_prompt,
        model=agent_def.model,
        setting_sources=["project"],
    )

    start_ns = time.monotonic_ns()

    _log_claude_command(rune_id, agent_def.model, agent_def.tools, verbose)

    # Use injected client factory for testing, or create real SDK client
    if _client_factory is not None:
        client_context = _client_factory()
    else:
        # Create SDK client via patched constructor (tests can patch agent.ClaudeSDKClient)
        client_context = ClaudeSDKClient(options=options)  # noqa: F405

    async with client_context as client:
        await client.query(prompt)

        got_result, last_ns, stats, last_assistant_message = await _drain_messages(
            client, rune_id, agent_name, verbose, start_ns=start_ns
        )

        # FAIL: If we didn't get a result, return False immediately
        if not got_result:
            logger.error("Agent %r produced no ResultMessage", agent_name)
            return False, False

        # FAIL: If stats is empty, we didn't really get a result
        if not stats or not isinstance(stats, dict):
            logger.error(
                "Agent %r produced result but stats is invalid (stats=%s)",
                agent_name,
                stats,
            )
            return False, False

        # FAIL: If we don't have all required stat keys, result is incomplete
        required_stat_keys = {
            "duration_ms",
            "input_tokens",
            "output_tokens",
            "num_turns",
        }
        if not required_stat_keys.issubset(stats.keys()):
            logger.error(
                "Agent %r produced incomplete result (missing keys: %s)",
                agent_name,
                required_stat_keys - set(stats.keys()),
            )
            return False, False

        # SUCCESS: We have a valid result. Now run hooks to verify everything is OK.
        hooks_passed, last_ns, skip_fulfill = await _run_rune_stop_hooks(
            rune_stop_hooks,
            rune_json,
            cwd,
            client,
            rune_id,
            agent_name,
            verbose,
            last_ns,
            last_assistant_message,
        )

        # Append completion note only if hooks also passed
        if hooks_passed:
            try:
                note_text = format_completion_note(stats)
                api_url = os.environ.get("BIFROST_API_URL", "http://localhost:8000")
                append_completion_note_to_api(rune_id, note_text, api_url)
            except Exception as exc:
                logger.warning("Failed to append completion note: %s", exc)

        # Return (success, skip_fulfill) — used to decide if we exit 0 or -2
        return hooks_passed, skip_fulfill


def _log_verbose_message(
    rune_id: str,
    message: object,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    elapsed_ms: int,
) -> None:  # noqa: N803
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock) and block.text.strip():
                first_line = block.text.strip().splitlines()[0][:120]
                _log_verbose(rune_id, f"text: {first_line}", elapsed_ms=elapsed_ms)
            elif isinstance(block, ToolUseBlock):
                inp = block.input or {}
                inp_summary = ", ".join(
                    f"{k}={str(v)[:60]}" for k, v in list(inp.items())[:3]
                )
                _log_verbose(
                    rune_id, f"tool: {block.name}({inp_summary})", elapsed_ms=elapsed_ms
                )


def _find_project_root() -> str:
    """Walk up from cwd to find .bifrost.yaml or .git."""
    path = Path(os.getcwd())
    for candidate in [path, *path.parents]:
        if (candidate / ".bifrost.yaml").exists() or (candidate / ".git").exists():
            return str(candidate)
    return str(path)


def format_completion_note(stats: dict) -> str:
    """
    Format a human-readable completion note from execution statistics.

    Args:
        stats: Dictionary with keys: duration_ms, input_tokens, output_tokens,
               cache_read_tokens, cache_creation_tokens, total_cost_usd, num_turns

    Returns:
        Human-readable note string with orchestrator marker
    """
    duration_ms = stats.get("duration_ms", 0)
    duration_s = duration_ms / 1000.0

    # Format duration based on magnitude
    if duration_s < 1:
        duration_str = f"{duration_ms:.0f}ms"
    elif duration_s < 60:
        duration_str = f"{duration_s:.1f}s"
    elif duration_s < 3600:
        duration_str = f"{duration_s / 60:.1f}m"
    else:
        hours = duration_s / 3600.0
        duration_str = f"{hours:.1f}h"

    input_tokens = stats.get("input_tokens", 0)
    output_tokens = stats.get("output_tokens", 0)
    cache_read = stats.get("cache_read_tokens", 0)
    cache_write = stats.get("cache_creation_tokens", 0)
    total_cost = stats.get("total_cost_usd", 0)
    num_turns = stats.get("num_turns", 0)

    # Format token counts with comma separators
    input_str = f"{input_tokens:,}"
    output_str = f"{output_tokens:,}"
    cost_str = f"${total_cost:.4f}"

    # Build note parts - put orchestrator marker early but use parentheses to avoid JSON-like start
    parts = [
        f"(orchestrator) Completed in {duration_str} over {num_turns} turn{'s' if num_turns != 1 else ''}.",
        f"Tokens: {input_str} input, {output_str} output.",
    ]

    # Only include cache stats if they're non-zero
    cache_parts = []
    if cache_read > 0:
        cache_parts.append(f"{cache_read:,} cache read")
    if cache_write > 0:
        cache_parts.append(f"{cache_write:,} cache creation")
    if cache_parts:
        parts.append(f"Cache: {', '.join(cache_parts)}.")

    parts.append(f"Cost: {cost_str}.")

    return " ".join(parts)


def post_to_api(url: str, payload: dict) -> None:
    """
    Make an HTTP POST request to the Bifrost API.

    Args:
        url: Full URL endpoint (e.g., "http://localhost:8000/api/add-note")
        payload: JSON payload to send

    Raises:
        Exceptions from requests library on network/API errors
    """
    import requests

    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to POST to %s: %s", url, exc)


def append_completion_note_to_api(rune_id: str, note_text: str, api_url: str) -> None:
    """
    Append a completion note to a rune via the Bifrost API.

    Args:
        rune_id: The ID of the rune to append the note to
        note_text: The formatted note text
        api_url: Base API URL (e.g., "http://localhost:8000")
    """
    endpoint = f"{api_url}/api/add-note"
    payload = {
        "rune_id": rune_id,
        "text": note_text,
    }
    post_to_api(endpoint, payload)


if __name__ == "__main__":
    main()
