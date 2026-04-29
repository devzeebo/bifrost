#!/usr/bin/env python3
"""
Bifrost agent runner — thin entry point.

All logic lives in claude_orchestrator.cli.agent_entry.

Backward-compat re-exports are provided here for existing tests.
"""

import logging
import sys
from pathlib import Path

# Ensure the orchestrator package is importable when run via uv
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)

# Backward-compat re-exports for existing tests
from claude_orchestrator.reporting import format_completion_note  # noqa: E402
from claude_agent_sdk import ClaudeSDKClient  # noqa: E402


def post_to_api(url: str, payload: dict) -> None:
    """Backward-compat shim. Delegates to BifrostAPIClient internals."""
    import requests
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logging.getLogger(__name__).warning("Failed to POST to %s: %s", url, exc)


def append_completion_note_to_api(rune_id: str, note_text: str, api_url: str) -> None:
    """Backward-compat shim."""
    endpoint = f"{api_url}/api/add-note"
    payload = {"rune_id": rune_id, "text": note_text}
    post_to_api(endpoint, payload)


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
    _client_factory=None,
) -> tuple[bool, bool]:
    """
    Backward-compat shim for tests.

    Runs the agent directly using the old procedural approach so existing tests
    that directly call _run_agent continue to work.
    """
    import json
    import time

    from claude_agent_sdk import ClaudeAgentOptions
    from claude_orchestrator.hook_runner import HookRunner, RuneStopOutcome
    from claude_orchestrator.sdk_runner import _drain_messages, _log_invocation
    from claude_orchestrator.reporting import format_completion_note

    options = ClaudeAgentOptions(
        cwd=cwd,
        tools=agent_def.tools,
        allowed_tools=agent_def.tools,
        permission_mode="dontAsk",
        system_prompt=system_prompt,
        model=agent_def.model,
        setting_sources=["project"],
    )

    _log_invocation(rune_id, agent_def.model, agent_def.tools, verbose)

    # Build a minimal AgentEntry-like object for _drain_messages
    class _FakeEntry:
        class _FakeDef:
            description = agent_name
        definition = _FakeDef()

    if _client_factory is not None:
        client_context = _client_factory()
    else:
        import agent as _self
        client_context = _self.ClaudeSDKClient(options=options)

    start_ns = time.monotonic_ns()
    skip_fulfill = False

    async with client_context as client:
        await client.query(prompt)
        try:
            turn = await _drain_messages(client, rune_id, _FakeEntry(), verbose, start_ns=start_ns)
        except RuntimeError:
            logging.getLogger(__name__).error("Agent %r produced no ResultMessage", agent_name)
            return False, False

        # Run RuneStop hooks (old imperative style for compat)
        while rune_stop_hooks:
            restarted = False
            for hook in rune_stop_hooks:
                import subprocess, os as _os
                env = _os.environ.copy()
                env["CLAUDE_PROJECT_DIR"] = cwd
                hook_input = json.dumps({
                    "rune": json.loads(rune_json),
                    "last_agent_message": turn.last_assistant_message,
                    "cwd": cwd,
                })
                try:
                    result = subprocess.run(
                        hook.command, shell=True, input=hook_input,
                        capture_output=True, text=True, env=env, cwd=cwd,
                    )
                except Exception as exc:
                    logging.getLogger(__name__).warning("hook:RuneStop command=%s failed: %s", hook.command, exc)
                    continue

                hook_output = result.stdout.strip() or result.stderr.strip()
                if result.returncode == 0:
                    continue
                elif result.returncode == -2:
                    skip_fulfill = True
                    continue
                elif result.returncode == 1:
                    follow_up = (
                        "A post-completion hook reported an issue and provided "
                        f"additional context. Please review and address it:\n\n{hook_output}"
                    )
                    await client.query(follow_up)
                    try:
                        turn = await _drain_messages(client, rune_id, _FakeEntry(), verbose, start_ns=time.monotonic_ns())
                    except RuntimeError:
                        return False, skip_fulfill
                    restarted = True
                    break
                elif result.returncode == 2:
                    return False, skip_fulfill
            if not restarted:
                break

        # Post completion note
        try:
            note_text = format_completion_note(turn.stats)
            import os
            api_url = os.environ.get("BIFROST_API_URL", "http://localhost:8000")
            append_completion_note_to_api(rune_id, note_text, api_url)
        except Exception as exc:
            logging.getLogger(__name__).warning("Failed to append completion note: %s", exc)

        return True, skip_fulfill


from claude_orchestrator.cli.agent_entry import agent_main  # noqa: E402

if __name__ == "__main__":
    sys.exit(agent_main(sys.argv, sys.stdin))
