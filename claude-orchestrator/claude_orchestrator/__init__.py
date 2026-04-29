"""
Public interface for claude-orchestrator hook authors.

    from claude_orchestrator import (
        Rune, RuneContext,
        HookWrapper,
        SkipAgent, SkipFulfill, FollowUpNeeded, HookError,
        RuneStartHook, RuneStopHook,
    )
"""

from claude_orchestrator._rune_types import (
    ACEntry,
    DependencyRef,
    NoteEntry,
    RetroEntry,
    Rune,
    RuneDetail,
)
from claude_orchestrator.domain import RuneContext
from claude_orchestrator.hooks import (
    FollowUpNeeded,
    HookError,
    HookWrapper,
    RuneStartHook,
    RuneStopHook,
    SkipAgent,
    SkipFulfill,
)

__all__ = [
    # Rune value objects (generated from Go)
    "Rune",
    "RuneDetail",
    "RuneContext",
    "DependencyRef",
    "NoteEntry",
    "ACEntry",
    "RetroEntry",
    # Hook author interface
    "HookWrapper",
    "RuneStartHook",
    "RuneStopHook",
    "SkipAgent",
    "SkipFulfill",
    "FollowUpNeeded",
    "HookError",
]
