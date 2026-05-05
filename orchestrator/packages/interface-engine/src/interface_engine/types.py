"""Core types for the engine interface."""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class EngineContext:
    """Context for engine execution."""

    task_id: str
    working_dir: str
    agent_name: str
    verbose: bool = False


@dataclass(frozen=True)
class ExecutionStats:
    """Telemetry from a single engine execution."""

    duration_ms: int
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_creation_tokens: int
    total_cost_usd: float
    num_turns: int

    def __add__(self, other: "ExecutionStats") -> "ExecutionStats":
        """Accumulate stats across multiple executions."""
        return ExecutionStats(
            duration_ms=self.duration_ms + other.duration_ms,
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
            cache_read_tokens=self.cache_read_tokens + other.cache_read_tokens,
            cache_creation_tokens=self.cache_creation_tokens + other.cache_creation_tokens,
            total_cost_usd=self.total_cost_usd + other.total_cost_usd,
            num_turns=self.num_turns + other.num_turns,
        )


@dataclass(frozen=True)
class EngineResult:
    """Result from engine execution."""

    success: bool
    skip_fulfill: bool
    last_message: Optional[str]
    stats: Optional[ExecutionStats]
