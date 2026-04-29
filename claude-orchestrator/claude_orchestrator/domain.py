"""
Core domain value objects for the claude-orchestrator.

Rune and sub-types are auto-generated from Go source — see _rune_types.py.
All other types here are pure value objects with no I/O.
"""

from __future__ import annotations

import importlib
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


def _maybe_regenerate_rune_types() -> None:
    """Re-run codegen if any Go source is newer than the generated file."""
    pkg_dir = Path(__file__).parent
    generated = pkg_dir / "_rune_types.py"
    script = pkg_dir.parent / "scripts" / "gen_rune_types.py"

    if not script.exists():
        return

    go_sources = [
        pkg_dir.parent.parent / "bifrost" / "domain" / "projectors" / "rune_detail.go",
        pkg_dir.parent.parent / "bifrost" / "domain" / "projectors" / "rune_retro_projector.go",
    ]
    existing_sources = [p for p in go_sources if p.exists()]
    if not existing_sources:
        return

    generated_mtime = generated.stat().st_mtime if generated.exists() else 0
    if any(p.stat().st_mtime > generated_mtime for p in existing_sources):
        subprocess.run([sys.executable, str(script)], check=True)
        # Reload the generated module so the freshly written code is used
        import claude_orchestrator._rune_types as _rt
        importlib.reload(_rt)


_maybe_regenerate_rune_types()

# Re-export generated Rune types
from claude_orchestrator._rune_types import (
    ACEntry,
    DependencyRef,
    NoteEntry,
    RetroEntry,
    Rune,
    RuneDetail,
)

__all__ = [
    # Generated from Go
    "DependencyRef",
    "NoteEntry",
    "ACEntry",
    "RetroEntry",
    "RuneDetail",
    "Rune",
    # Orchestration domain
    "RuneContext",
    "ExecutionStats",
    "SDKTurnResult",
    "RuneStopVerdict",
    "OrchestrationResult",
]


@dataclass(frozen=True)
class RuneContext:
    """Rune + execution environment."""

    rune: Rune
    cwd: str


@dataclass(frozen=True)
class ExecutionStats:
    """Telemetry from a single SDK turn."""

    duration_ms: int
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_creation_tokens: int
    total_cost_usd: float
    num_turns: int

    def __add__(self, other: ExecutionStats) -> ExecutionStats:
        """Accumulate stats across follow-up turns."""
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
class SDKTurnResult:
    """Result of one complete SDK streaming session."""

    last_assistant_message: str | None
    stats: ExecutionStats


class RuneStopVerdict(Enum):
    SUCCESS = "success"
    SKIP_FULFILL = "skip_fulfill"
    BLOCKING_FAILURE = "blocking_failure"
    FOLLOW_UP = "follow_up"


@dataclass(frozen=True)
class OrchestrationResult:
    """Terminal result of a full rune orchestration run."""

    success: bool
    skip_fulfill: bool
    stats: ExecutionStats | None
