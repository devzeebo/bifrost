"""Core domain value objects for the orchestrator."""

from dataclasses import dataclass
from enum import Enum

from interface_engine.types import EngineResult


class RuneStopVerdict(Enum):
    SUCCESS = "success"
    SKIP_FULFILL = "skip_fulfill"
    BLOCKING_FAILURE = "blocking_failure"
    FOLLOW_UP = "follow_up"


@dataclass(frozen=True)
class RuneContext:
    """Rune + execution environment."""

    rune_id: str
    title: str
    description: str | None
    cwd: str
    tags: list[str]
    raw_detail: dict  # Raw rune detail from task source


@dataclass(frozen=True)
class OrchestrationResult:
    """Terminal result of a full rune orchestration run."""

    success: bool
    skip_fulfill: bool
    engine_result: EngineResult | None
