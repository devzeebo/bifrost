"""
Claude SDK execution — drives ClaudeSDKClient and returns typed SDKTurnResult.

Anti-corruption layer between the SDK's streaming protocol and the domain.
"""

from __future__ import annotations

import logging
import sys
import time
from typing import Callable

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

from claude_orchestrator.agent_catalog.types import AgentEntry
from claude_orchestrator.domain import ExecutionStats, RuneContext, SDKTurnResult

logger = logging.getLogger(__name__)

# ANSI color codes for worker prefixes
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


def _log_verbose(worker_id: str, msg: str, elapsed_ms: int | None = None) -> None:
    prefix = _worker_prefix(worker_id)
    ts = f"\033[2m+{elapsed_ms}ms\033[0m " if elapsed_ms is not None else ""
    print(f"{prefix}: {ts}{msg}", file=sys.stderr)


class SDKRunner:
    """Drives the Claude Agent SDK for a single rune execution context."""

    def __init__(
        self,
        entry: AgentEntry,
        context: RuneContext,
        verbose: bool = False,
        client_factory: Callable | None = None,
    ) -> None:
        self.entry = entry
        self.context = context
        self.verbose = verbose
        self._client_factory = client_factory
        self._client = None  # set during async with

    async def run(self, prompt: str, system_prompt: str) -> SDKTurnResult:
        """Run one complete SDK turn and return typed result."""
        agent_def = self.entry.definition
        rune_id = self.context.rune.id

        options = ClaudeAgentOptions(
            cwd=self.context.cwd,
            tools=agent_def.tools,
            allowed_tools=agent_def.tools,
            permission_mode="dontAsk",
            system_prompt=system_prompt,
            model=agent_def.model,
            setting_sources=["project"],
        )

        _log_invocation(rune_id, agent_def.model, agent_def.tools, self.verbose)

        if self._client_factory is not None:
            client_context = self._client_factory()
        else:
            client_context = ClaudeSDKClient(options=options)

        start_ns = time.monotonic_ns()

        async with client_context as client:
            self._client = client
            await client.query(prompt)
            result = await _drain_messages(client, rune_id, self.entry, self.verbose, start_ns=start_ns)

        self._client = None
        return result

    async def send_follow_up(self, message: str) -> SDKTurnResult:
        """Send a follow-up message to an active client session."""
        if self._client is None:
            raise RuntimeError("send_follow_up called outside of active SDK session")
        rune_id = self.context.rune.id
        start_ns = time.monotonic_ns()
        await self._client.query(message)
        return await _drain_messages(self._client, rune_id, self.entry, self.verbose, start_ns=start_ns)


async def _drain_messages(
    client,
    rune_id: str,
    entry: AgentEntry,
    verbose: bool,
    *,
    start_ns: int,
) -> SDKTurnResult:
    """Drain messages from client until ResultMessage. Returns SDKTurnResult."""
    from claude_agent_sdk import AssistantMessage, TextBlock, ToolUseBlock

    agent_name = entry.definition.description or rune_id
    last_ns = start_ns
    last_assistant_message: str | None = None

    async for message in client.receive_messages():
        now_ns = time.monotonic_ns()
        since_last_ms = (now_ns - last_ns) // 1_000_000
        last_ns = now_ns

        message_type_name = type(message).__name__

        if message_type_name == "AssistantMessage":
            text_parts = []
            if hasattr(message, "content"):
                for block in message.content:
                    if hasattr(block, "text") and block.text:
                        text_parts.append(block.text)
            last_assistant_message = "\n".join(text_parts) if text_parts else None

        if verbose:
            _log_verbose_message(rune_id, message, AssistantMessage, TextBlock, ToolUseBlock, since_last_ms)

        if message_type_name in ("ResultMessage", "MockResultMessage"):
            total_ms = (now_ns - start_ns) // 1_000_000
            usage = message.usage or {}
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            cache_read = usage.get("cache_read_input_tokens", 0)
            cache_write = usage.get("cache_creation_input_tokens", 0)
            cost = message.total_cost_usd or 0.0

            if verbose:
                token_parts = [f"in={input_tokens}", f"out={output_tokens}"]
                if cache_read:
                    token_parts.append(f"cache_read={cache_read}")
                if cache_write:
                    token_parts.append(f"cache_write={cache_write}")
                _log_verbose(
                    rune_id,
                    f"done turns={message.num_turns} total={total_ms}ms"
                    f"  tokens={' '.join(token_parts)}  cost=${cost:.4f}",
                )
            else:
                logger.info(
                    "Agent %r completed: turns=%d time=%dms tokens(in=%d out=%d) cost=$%.4f — %s",
                    agent_name,
                    message.num_turns,
                    total_ms,
                    input_tokens,
                    output_tokens,
                    cost,
                    (message.result or "")[:200],
                )

            stats = ExecutionStats(
                duration_ms=total_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_read_tokens=cache_read,
                cache_creation_tokens=cache_write,
                total_cost_usd=cost,
                num_turns=message.num_turns,
            )
            return SDKTurnResult(last_assistant_message=last_assistant_message, stats=stats)

    raise RuntimeError(f"Agent {agent_name!r} produced no ResultMessage")


def _log_invocation(rune_id: str, model: str, tools: list[str] | None, verbose: bool) -> None:
    parts = ["claude", f"--model {model}", "--permission-mode dontAsk"]
    if tools:
        parts.append(f"--tools {','.join(tools)}")
        parts.append(f"--allowedTools {','.join(tools)}")
    cmd_str = " ".join(parts)
    if verbose:
        _log_verbose(rune_id, f"exec: {cmd_str}", elapsed_ms=0)
    else:
        logger.info("Starting agent: %s", cmd_str)


def _log_verbose_message(
    rune_id: str,
    message: object,
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    elapsed_ms: int,
) -> None:
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, TextBlock) and block.text.strip():
                first_line = block.text.strip().splitlines()[0][:120]
                _log_verbose(rune_id, f"text: {first_line}", elapsed_ms=elapsed_ms)
            elif isinstance(block, ToolUseBlock):
                inp = block.input or {}
                inp_summary = ", ".join(f"{k}={str(v)[:60]}" for k, v in list(inp.items())[:3])
                _log_verbose(rune_id, f"tool: {block.name}({inp_summary})", elapsed_ms=elapsed_ms)
