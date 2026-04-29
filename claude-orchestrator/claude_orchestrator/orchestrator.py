"""
Rune orchestration — coordinates RuneStart→SDK→RuneStop lifecycle.

This is the application service layer. It owns no domain logic directly;
it sequences hook_runner and sdk_runner and drives the follow-up retry loop.
"""

from __future__ import annotations

import logging

from claude_orchestrator.agent_catalog.types import AgentEntry
from claude_orchestrator.domain import (
    ExecutionStats,
    OrchestrationResult,
    RuneContext,
    RuneStopVerdict,
    SDKTurnResult,
)
from claude_orchestrator.hook_runner import HookRunner, RuneStopOutcome
from claude_orchestrator.reporting import BifrostAPIClient
from claude_orchestrator.sdk_runner import SDKRunner

logger = logging.getLogger(__name__)


class RuneOrchestrator:
    def __init__(
        self,
        context: RuneContext,
        entry: AgentEntry,
        hook_runner: HookRunner,
        sdk_runner: SDKRunner,
        api_client: BifrostAPIClient,
        verbose: bool = False,
    ) -> None:
        self.context = context
        self.entry = entry
        self.hook_runner = hook_runner
        self.sdk_runner = sdk_runner
        self.api_client = api_client
        self.verbose = verbose

    async def run(self) -> OrchestrationResult:
        rune = self.context.rune
        agent_name = self.entry.definition.description or rune.id

        logger.info("Running agent %r for rune %s in %s", agent_name, rune.id, self.context.cwd)

        # --- RuneStart hooks ---
        start_result = self.hook_runner.run_rune_start(
            self.entry.hooks.rune_start, self.context
        )

        if start_result.error:
            logger.error("RuneStart hook reported error, exiting with failure")
            return OrchestrationResult(success=False, skip_fulfill=False, stats=None)

        if start_result.skip_agent:
            logger.info("RuneStart hook signaled skip agent (-2), exiting successfully")
            return OrchestrationResult(success=True, skip_fulfill=False, stats=None)

        system_prompt = self.entry.definition.prompt
        if start_result.extra_system_prompt:
            system_prompt = system_prompt + "\n\n" + start_result.extra_system_prompt

        prompt = _build_rune_prompt(rune)
        cumulative_stats: ExecutionStats | None = None
        skip_fulfill = False

        # --- SDK + RuneStop retry loop ---
        options = _SDKOptions(
            system_prompt=system_prompt,
            entry=self.entry,
            context=self.context,
        )

        async with _ManagedSession(self.sdk_runner, options) as session:
            turn: SDKTurnResult = await session.run(prompt)
            cumulative_stats = turn.stats

            while True:
                hook_results = self.hook_runner.run_rune_stop_once(
                    self.entry.hooks.rune_stop,
                    self.context,
                    turn.last_assistant_message,
                )

                verdict, follow_up_msg, hook_skip_fulfill = _interpret_hook_results(hook_results)

                if hook_skip_fulfill:
                    skip_fulfill = True

                if verdict == RuneStopVerdict.BLOCKING_FAILURE:
                    logger.error("RuneStop hook blocking failure for rune %s", rune.id)
                    return OrchestrationResult(success=False, skip_fulfill=False, stats=cumulative_stats)

                if verdict == RuneStopVerdict.FOLLOW_UP:
                    if not session.can_follow_up:
                        logger.error(
                            "Agent %r produced no active session for follow-up", agent_name
                        )
                        return OrchestrationResult(success=False, skip_fulfill=False, stats=cumulative_stats)
                    turn = await session.follow_up(follow_up_msg)
                    cumulative_stats = cumulative_stats + turn.stats
                    continue

                break  # SUCCESS or SKIP_FULFILL

        # --- Post completion note ---
        if cumulative_stats is not None:
            try:
                self.api_client.append_completion_note(rune.id, cumulative_stats)
            except Exception as exc:
                logger.warning("Failed to append completion note: %s", exc)

        return OrchestrationResult(success=True, skip_fulfill=skip_fulfill, stats=cumulative_stats)


def _build_rune_prompt(rune) -> str:
    lines = [
        f"Rune ID: {rune.id}",
        f"Title: {rune.title}",
    ]
    if rune.description:
        lines += ["", "Description:", rune.description]
    if rune.notes:
        lines += ["", "Notes:"]
        for note in rune.notes:
            if hasattr(note, "text") and note.text:
                lines.append(f"  - {note.text}")
    if rune.dependencies:
        lines += ["", "Dependencies:"]
        for dep in rune.dependencies:
            if hasattr(dep, "target_id"):
                lines.append(f"  - {dep.target_id} ({dep.relationship})")
    return "\n".join(lines)


def _interpret_hook_results(
    hook_results: list,
) -> tuple[RuneStopVerdict, str | None, bool]:
    """
    Reduce a list of RuneStopHookResult to a single verdict.

    Returns (verdict, follow_up_message, skip_fulfill).
    """
    skip_fulfill = False
    for result in hook_results:
        if result.outcome == RuneStopOutcome.SKIP_FULFILL:
            skip_fulfill = True
        elif result.outcome == RuneStopOutcome.BLOCKING_FAILURE:
            return RuneStopVerdict.BLOCKING_FAILURE, None, skip_fulfill
        elif result.outcome == RuneStopOutcome.FOLLOW_UP:
            return RuneStopVerdict.FOLLOW_UP, result.message, skip_fulfill
    return RuneStopVerdict.SUCCESS, None, skip_fulfill


class _SDKOptions:
    """Carries SDK configuration for a managed session."""

    def __init__(self, system_prompt: str, entry: AgentEntry, context: RuneContext) -> None:
        self.system_prompt = system_prompt
        self.entry = entry
        self.context = context


class _ManagedSession:
    """
    Async context manager that keeps the SDK client alive for follow-up turns.

    The SDK client must remain open across multiple query/drain cycles during
    the hook retry loop, so we manage its lifetime here.
    """

    def __init__(self, sdk_runner: SDKRunner, options: _SDKOptions) -> None:
        self._runner = sdk_runner
        self._options = options
        self._client_ctx = None
        self._client = None

    @property
    def can_follow_up(self) -> bool:
        return self._client is not None

    async def __aenter__(self) -> _ManagedSession:
        from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

        entry = self._options.entry
        context = self._options.context
        agent_def = entry.definition

        options = ClaudeAgentOptions(
            cwd=context.cwd,
            tools=agent_def.tools,
            allowed_tools=agent_def.tools,
            permission_mode="dontAsk",
            system_prompt=self._options.system_prompt,
            model=agent_def.model,
            setting_sources=["project"],
        )

        if self._runner._client_factory is not None:
            self._client_ctx = self._runner._client_factory()
        else:
            self._client_ctx = ClaudeSDKClient(options=options)

        self._client = await self._client_ctx.__aenter__()
        return self

    async def __aexit__(self, *args) -> None:
        if self._client_ctx is not None:
            await self._client_ctx.__aexit__(*args)
        self._client = None

    async def run(self, prompt: str) -> SDKTurnResult:
        from claude_orchestrator.sdk_runner import _drain_messages, _log_invocation
        import time

        rune_id = self._options.context.rune.id
        agent_def = self._options.entry.definition
        _log_invocation(rune_id, agent_def.model, agent_def.tools, self._runner.verbose)
        await self._client.query(prompt)
        return await _drain_messages(
            self._client, rune_id, self._options.entry, self._runner.verbose,
            start_ns=time.monotonic_ns()
        )

    async def follow_up(self, message: str) -> SDKTurnResult:
        from claude_orchestrator.sdk_runner import _drain_messages
        import time

        rune_id = self._options.context.rune.id
        await self._client.query(message)
        return await _drain_messages(
            self._client, rune_id, self._options.entry, self._runner.verbose,
            start_ns=time.monotonic_ns()
        )
