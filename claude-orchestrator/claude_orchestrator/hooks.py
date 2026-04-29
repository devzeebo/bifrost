"""
Hook interface and wrapper for hook authors.

Hook scripts import from this module and call HookWrapper.run_start / run_stop
with their delegate function. The wrapper manages stdin/stdout/exit-code protocol.

Usage (RuneStart hook):

    from claude_orchestrator.hooks import HookWrapper, RuneContext, SkipAgent, HookError

    def my_hook(context: RuneContext) -> str | None:
        if something_wrong:
            raise HookError("reason")
        return "extra system prompt text"

    if __name__ == "__main__":
        HookWrapper.run_start(my_hook)

Usage (RuneStop hook):

    from claude_orchestrator.hooks import HookWrapper, RuneContext, FollowUpNeeded, HookError

    def my_hook(context: RuneContext, last_agent_message: str | None) -> None:
        if needs_follow_up:
            raise FollowUpNeeded("Please fix the tests")
        if hard_failure:
            raise HookError("cannot fulfill")

    if __name__ == "__main__":
        HookWrapper.run_stop(my_hook)
"""

from __future__ import annotations

import json
import sys
from typing import Callable, Protocol

from claude_orchestrator._rune_types import Rune
from claude_orchestrator.domain import RuneContext


# ---------------------------------------------------------------------------
# Sentinel exceptions — replace exit codes with Python exceptions
# ---------------------------------------------------------------------------

class SkipAgent(Exception):
    """Raise from a RuneStart hook to skip the agent (success, no work done)."""


class SkipFulfill(Exception):
    """Raise from a RuneStop hook to succeed but skip rune fulfillment."""


class FollowUpNeeded(Exception):
    """Raise from a RuneStop hook to request an agent follow-up turn."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class HookError(Exception):
    """
    Raise from a RuneStart hook to fail the rune (exit 1).
    Raise from a RuneStop hook to blocking-fail (exit 2).
    """


# ---------------------------------------------------------------------------
# Protocols — what hook authors implement
# ---------------------------------------------------------------------------

class RuneStartHook(Protocol):
    def __call__(self, context: RuneContext) -> str | None:
        """
        Return extra system prompt text (appended before agent runs), or None.
        Raise SkipAgent to skip this rune entirely (success).
        Raise HookError to fail the rune.
        """
        ...


class RuneStopHook(Protocol):
    def __call__(self, context: RuneContext, last_agent_message: str | None) -> None:
        """
        Return normally to succeed and fulfill the rune.
        Raise FollowUpNeeded(message) to send message to agent and retry hooks.
        Raise SkipFulfill to succeed but skip rune fulfillment.
        Raise HookError to blocking-fail (rune not fulfilled).
        """
        ...


# ---------------------------------------------------------------------------
# HookWrapper — handles stdio protocol, calls delegate, exits correctly
# ---------------------------------------------------------------------------

class HookWrapper:
    """
    Manages the stdin/stdout/exit-code protocol between Bifrost and hook scripts.

    Hook scripts do not handle JSON parsing or exit codes directly.
    They implement a simple Python function and call HookWrapper.run_start or run_stop.
    """

    @staticmethod
    def run_start(delegate: RuneStartHook) -> None:
        """
        Read RuneContext from stdin, call delegate, write output to stdout, exit.

        Exit codes:
          0   — success (delegate returned)
          -2  — skip agent (SkipAgent raised)
          1   — hook error (HookError raised)
        """
        raw = json.load(sys.stdin)
        rune = Rune.from_dict(raw["rune"])
        context = RuneContext(rune=rune, cwd=raw.get("cwd", ""))
        try:
            extra = delegate(context)
            if extra:
                print(extra)
            sys.exit(0)
        except SkipAgent as e:
            if str(e):
                print(str(e), file=sys.stderr)
            sys.exit(-2)
        except HookError as e:
            print(str(e), file=sys.stderr)
            sys.exit(1)

    @staticmethod
    def run_stop(delegate: RuneStopHook) -> None:
        """
        Read RuneContext + last_agent_message from stdin, call delegate, exit.

        Exit codes:
          0   — success, fulfill rune
          -2  — success, skip fulfill (SkipFulfill raised)
          1   — non-blocking: stdout forwarded to agent as follow-up (FollowUpNeeded raised)
          2   — blocking failure, do not fulfill (HookError raised)
        """
        raw = json.load(sys.stdin)
        rune = Rune.from_dict(raw["rune"])
        context = RuneContext(rune=rune, cwd=raw.get("cwd", ""))
        last_msg: str | None = raw.get("last_agent_message")
        try:
            delegate(context, last_msg)
            sys.exit(0)
        except SkipFulfill as e:
            if str(e):
                print(str(e), file=sys.stderr)
            sys.exit(-2)
        except FollowUpNeeded as e:
            print(e.message)
            sys.exit(1)
        except HookError as e:
            print(str(e), file=sys.stderr)
            sys.exit(2)
