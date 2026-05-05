"""Hook execution — runs shell subprocess hooks and translates exit codes to typed outcomes."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from orchestrator.core.domain import RuneContext

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HookSpec:
    """Hook specification."""

    command: str


@dataclass(frozen=True)
class RuneStartResult:
    extra_system_prompt: str
    skip_agent: bool
    error: bool


class RuneStopOutcome(Enum):
    SUCCESS = "success"
    SKIP_FULFILL = "skip_fulfill"  # exit -2
    FOLLOW_UP = "follow_up"  # exit 1
    BLOCKING_FAILURE = "blocking"  # exit 2


@dataclass(frozen=True)
class RuneStopHookResult:
    outcome: RuneStopOutcome
    message: str | None = None  # populated when FOLLOW_UP


class HookRunner:
    def __init__(self, project_dir: str) -> None:
        self.project_dir = project_dir

    def run_rune_start(
        self,
        hooks: list[HookSpec],
        context: RuneContext,
    ) -> RuneStartResult:
        """Run all RuneStart hooks in order.

        Returns RuneStartResult with extra_system_prompt accumulated from stdout.
        Sets skip_agent=True on exit -2, error=True on positive exit code.
        """
        rune_dict = _context_to_dict(context)
        parts: list[str] = []

        for hook in hooks:
            try:
                result = self._run_command(hook.command, rune_dict, None)
                reason = (
                    (result.stderr.strip() or result.stdout.strip())
                    if result.returncode != 0
                    else ""
                )
                _log_hook("RuneStart", hook.command, result.returncode, reason)

                if result.returncode == -2:
                    if result.stdout.strip():
                        parts.append(result.stdout.strip())
                    return RuneStartResult(
                        extra_system_prompt="\n\n".join(parts),
                        skip_agent=True,
                        error=False,
                    )

                if result.returncode > 0:
                    logger.error("RuneStart hook failed with exit code %d", result.returncode)
                    if result.stdout.strip():
                        logger.error("RuneStart hook stdout:\n%s", result.stdout)
                    if result.stderr.strip():
                        logger.error("RuneStart hook stderr:\n%s", result.stderr)
                    if result.stdout.strip():
                        parts.append(result.stdout.strip())
                    return RuneStartResult(
                        extra_system_prompt="\n\n".join(parts),
                        skip_agent=False,
                        error=True,
                    )

                if result.stdout.strip():
                    parts.append(result.stdout.strip())
            except Exception as exc:
                logger.warning("hook:RuneStart command=%s failed: %s", hook.command, exc)

        return RuneStartResult(
            extra_system_prompt="\n\n".join(parts),
            skip_agent=False,
            error=False,
        )

    def run_rune_stop_once(
        self,
        hooks: list[HookSpec],
        context: RuneContext,
        last_agent_message: str | None,
    ) -> list[RuneStopHookResult]:
        """Run all RuneStop hooks once in order.

        Stops early on FOLLOW_UP or BLOCKING_FAILURE.
        Caller is responsible for the retry loop.
        """
        rune_dict = _context_to_dict(context)
        results: list[RuneStopHookResult] = []

        for hook in hooks:
            try:
                result = self._run_command(hook.command, rune_dict, last_agent_message)
            except Exception as exc:
                logger.warning("hook:RuneStop command=%s failed: %s", hook.command, exc)
                continue

            hook_output = result.stdout.strip() or result.stderr.strip()

            if result.returncode == 0:
                _log_hook("RuneStop", hook.command, 0)
                results.append(RuneStopHookResult(outcome=RuneStopOutcome.SUCCESS))

            elif result.returncode == -2:
                _log_hook("RuneStop", hook.command, -2, hook_output)
                results.append(RuneStopHookResult(outcome=RuneStopOutcome.SKIP_FULFILL))

            elif result.returncode == 1:
                _log_hook("RuneStop", hook.command, 1, hook_output)
                follow_up_msg = (
                    "A post-completion hook reported an issue and provided "
                    f"additional context. Please review and address it:\n\n{hook_output}"
                )
                results.append(
                    RuneStopHookResult(
                        outcome=RuneStopOutcome.FOLLOW_UP,
                        message=follow_up_msg,
                    )
                )
                break  # caller restarts from first hook after follow-up

            elif result.returncode == 2:
                _log_hook("RuneStop", hook.command, 2, hook_output)
                results.append(RuneStopHookResult(outcome=RuneStopOutcome.BLOCKING_FAILURE))
                break

            else:
                _log_hook("RuneStop", hook.command, result.returncode, hook_output)

        return results

    def _run_command(
        self,
        command: str,
        rune_dict: dict,
        last_agent_message: str | None,
    ) -> subprocess.CompletedProcess:
        env = os.environ.copy()
        env["CLAUDE_PROJECT_DIR"] = self.project_dir

        hook_input = json.dumps(
            {
                "rune": rune_dict,
                "last_agent_message": last_agent_message,
                "cwd": self.project_dir,
            }
        )

        return subprocess.run(
            command,
            shell=True,
            input=hook_input,
            capture_output=True,
            text=True,
            env=env,
            cwd=self.project_dir,
        )


def _context_to_dict(context: RuneContext) -> dict:
    """Convert a RuneContext to a plain dict for JSON serialization."""
    return {
        "id": context.rune_id,
        "title": context.title,
        "description": context.description,
        "tags": context.tags,
    }


def _log_hook(event: str, command: str, returncode: int, reason: str = "") -> None:
    if returncode == 0:
        logger.info("hook:%s command=%s result=0", event, command)
    else:
        truncated = reason[:100] + ("..." if len(reason) > 100 else "")
        logger.warning(
            "hook:%s command=%s result=%d reason=%s", event, command, returncode, truncated
        )
