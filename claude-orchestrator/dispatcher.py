#!/usr/bin/env python3
"""
Bifrost dispatcher script.

Reads DispatchInput JSON from stdin, extracts the worker:<name> tag,
and writes a DispatchResult JSON to stdout pointing to agent.py.

Exit 0 always. Empty command = skip (unclaim) the rune.
"""

import json
import os
import sys
from pathlib import Path

# Ensure the orchestrator package is importable when run via uv
sys.path.insert(0, str(Path(__file__).parent))


def main() -> None:
    if "--list-agents" in sys.argv:
        _list_agents()
        return

    try:
        dispatch_input = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"dispatcher: invalid JSON on stdin: {exc}", file=sys.stderr)
        sys.exit(1)

    # Extract rune and cwd from DispatchInput { rune, cwd }
    rune = dispatch_input.get("rune", {})
    cwd = dispatch_input.get("cwd", "")

    tags: list[str] = rune.get("tags") or []
    agent_name: str | None = None
    for tag in tags:
        if tag.startswith("worker:"):
            agent_name = tag[len("worker:") :]
            break

    if not agent_name:
        # No worker tag — tell CLI to skip (unclaim) this rune
        _emit({"command": "", "args": [], "stdin": "", "env": {}})
        return

    script_dir = os.path.dirname(os.path.abspath(__file__))
    agent_script = os.path.join(script_dir, "agent.py")

    # Pass { rune, cwd } to agent
    agent_input = {
        "rune": rune,
        "cwd": cwd,
    }

    _emit(
        {
            "command": "uv",
            "args": ["run", "--project", script_dir, agent_script, agent_name],
            "stdin": json.dumps(agent_input),
            "env": {},
        }
    )


def _list_agents() -> None:
    from agents.loader import registry

    registry.load_all()
    agents = registry.all()
    if not agents:
        print("No agents found.", file=sys.stderr)
        return
    for name, entry in sorted(agents.items()):
        defn = entry.definition
        hooks = entry.hooks
        print(f"  {name}")
        if defn.description:
            print(f"    description:      {defn.description}")
        if defn.model:
            print(f"    model:            {defn.model}")
        if defn.tools:
            print(f"    tools:            {', '.join(defn.tools)}")
        if hooks.rune_start:
            print(
                f"    rune_start_hooks: {', '.join(str(p) for p in hooks.rune_start)}"
            )
        if hooks.rune_stop:
            print(f"    rune_stop_hooks:  {', '.join(str(p) for p in hooks.rune_stop)}")


def _emit(result: dict) -> None:
    print(json.dumps(result))


if __name__ == "__main__":
    main()
