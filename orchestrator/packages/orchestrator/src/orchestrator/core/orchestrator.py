"""Rune orchestration — coordinates task lifecycle with hooks and engine execution."""

from __future__ import annotations

import logging

from interface_engine.types import EngineContext, EngineResult, ExecutionStats

from orchestrator.core.domain import OrchestrationResult, RuneContext, RuneStopVerdict
from orchestrator.core.hook_runner import HookRunner, RuneStopOutcome
from orchestrator.core.reporting import BifrostAPIClient

logger = logging.getLogger(__name__)


class AgentEntry:
    """Agent definition for engine execution."""

    def __init__(
        self,
        name: str,
        model: str,
        prompt: str,
        tools: list[str] | None = None,
        rune_start_hooks: list[HookSpec] | None = None,
        rune_stop_hooks: list[HookSpec] | None = None,
    ) -> None:
        self.name = name
        self.model = model
        self.prompt = prompt
        self.tools = tools or []
        self.rune_start_hooks = rune_start_hooks or []
        self.rune_stop_hooks = rune_stop_hooks or []


class HookSpec:
    """Hook specification for backward compatibility."""

    def __init__(self, command: str) -> None:
        self.command = command


class RuneOrchestrator:
    """Coordinates task lifecycle: hooks → engine → follow-up loop."""

    def __init__(
        self,
        context: RuneContext,
        entry: AgentEntry,
        hook_runner: HookRunner,
        engine,
        api_client: BifrostAPIClient | None = None,
        verbose: bool = False,
    ) -> None:
        self.context = context
        self.entry = entry
        self.hook_runner = hook_runner
        self.engine = engine
        self.api_client = api_client
        self.verbose = verbose

    async def run(self) -> OrchestrationResult:
        agent_name = self.entry.name
        rune_id = self.context.rune_id

        logger.info("Running agent %r for task %s in %s", agent_name, rune_id, self.context.cwd)

        # --- RuneStart hooks ---
        start_result = self.hook_runner.run_rune_start(
            self.entry.rune_start_hooks, self.context
        )

        if start_result.error:
            logger.error("RuneStart hook reported error, exiting with failure")
            return OrchestrationResult(success=False, skip_fulfill=False, engine_result=None)

        if start_result.skip_agent:
            logger.info("RuneStart hook signaled skip agent (-2), exiting successfully")
            return OrchestrationResult(success=True, skip_fulfill=False, engine_result=None)

        system_prompt = self.entry.prompt
        if start_result.extra_system_prompt:
            system_prompt = system_prompt + "\n\n" + start_result.extra_system_prompt

        prompt = _build_task_prompt(self.context)

        # --- Engine execution with follow-up loop ---
        engine_ctx = EngineContext(
            task_id=rune_id,
            working_dir=self.context.cwd,
            agent_name=agent_name,
            verbose=self.verbose,
        )

        task_data = {
            "system_prompt": system_prompt,
            "prompt": prompt,
            "raw_detail": self.context.raw_detail,
        }

        engine_result: EngineResult = await self.engine.execute(engine_ctx, task_data)

        # --- RuneStop hooks with follow-up retry loop ---
        last_message = engine_result.last_message
        cumulative_stats = engine_result.stats
        skip_fulfill = engine_result.skip_fulfill

        while True:
            hook_results = self.hook_runner.run_rune_stop_once(
                self.entry.rune_stop_hooks,
                self.context,
                last_message,
            )

            verdict, follow_up_msg, hook_skip_fulfill = _interpret_hook_results(hook_results)

            if hook_skip_fulfill:
                skip_fulfill = True

            if verdict == RuneStopVerdict.BLOCKING_FAILURE:
                logger.error("RuneStop hook blocking failure for task %s", rune_id)
                return OrchestrationResult(success=False, skip_fulfill=False, engine_result=cumulative_stats)

            if verdict == RuneStopVerdict.FOLLOW_UP:
                # Check if engine supports follow-up
                if hasattr(self.engine, "send_follow_up"):
                    follow_up_result = await self.engine.send_follow_up(follow_up_msg)
                    last_message = follow_up_result.last_message
                    if cumulative_stats and follow_up_result.stats:
                        cumulative_stats = ExecutionStats(
                            duration_ms=cumulative_stats.duration_ms + follow_up_result.stats.duration_ms,
                            input_tokens=cumulative_stats.input_tokens + follow_up_result.stats.input_tokens,
                            output_tokens=cumulative_stats.output_tokens + follow_up_result.stats.output_tokens,
                            cache_read_tokens=cumulative_stats.cache_read_tokens + follow_up_result.stats.cache_read_tokens,
                            cache_creation_tokens=cumulative_stats.cache_creation_tokens + follow_up_result.stats.cache_creation_tokens,
                            total_cost_usd=cumulative_stats.total_cost_usd + follow_up_result.stats.total_cost_usd,
                            num_turns=cumulative_stats.num_turns + follow_up_result.stats.num_turns,
                        )
                    continue
                else:
                    logger.error("Engine does not support follow-up for task %s", rune_id)
                    return OrchestrationResult(success=False, skip_fulfill=False, engine_result=cumulative_stats)

            break  # SUCCESS or SKIP_FULFILL

        # --- Post completion note ---
        if self.api_client and cumulative_stats:
            try:
                self.api_client.append_completion_note(rune_id, cumulative_stats)
            except Exception as exc:
                logger.warning("Failed to append completion note: %s", exc)

        return OrchestrationResult(success=True, skip_fulfill=skip_fulfill, engine_result=cumulative_stats)


def _build_task_prompt(context: RuneContext) -> str:
    lines = [
        f"Task ID: {context.rune_id}",
        f"Title: {context.title}",
    ]
    if context.description:
        lines += ["", "Description:", context.description]
    if context.tags:
        lines += ["", "Tags:", ", ".join(context.tags)]
    return "\n".join(lines)


def _interpret_hook_results(
    hook_results: list,
) -> tuple[RuneStopVerdict, str | None, bool]:
    """Reduce a list of RuneStopHookResult to a single verdict.

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
