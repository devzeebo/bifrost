"""Core types for the task source interface."""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class TaskStatus(str, Enum):
    """Status of a task."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class Task:
    """A task to be executed."""

    id: str
    title: str
    status: TaskStatus
    tags: list[str]
    claimant: Optional[str]
    raw_data: dict


@dataclass(frozen=True)
class DependencyRef:
    """Reference to a dependency task."""

    target_id: str
    relationship: str


@dataclass(frozen=True)
class NoteEntry:
    """Note attached to a task."""

    text: str


@dataclass(frozen=True)
class ACEntry:
    """Acceptance criteria entry."""

    text: str


@dataclass(frozen=True)
class RetroEntry:
    """Retrospective entry."""

    text: str


@dataclass(frozen=True)
class TaskDetail:
    """Detailed task information."""

    task: Task
    description: Optional[str]
    dependencies: list[DependencyRef]
    notes: list[NoteEntry]
    acceptance_criteria: list[ACEntry]
    retro: list[RetroEntry]
