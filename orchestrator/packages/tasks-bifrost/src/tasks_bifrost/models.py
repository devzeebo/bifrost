"""Bifrost-specific task models."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from interface_tasks.types import Task, TaskDetail, TaskStatus


@dataclass(frozen=True)
class BifrostTask(Task):
    """Bifrost-specific task implementation."""

    created_at: datetime | None
    updated_at: datetime | None
    priority: int

    @staticmethod
    def from_api(data: dict[str, Any]) -> "BifrostTask":
        """Create a BifrostTask from API response data."""
        return BifrostTask(
            id=data.get("id", ""),
            title=data.get("title", ""),
            status=TaskStatus(data.get("status", "open")),
            tags=data.get("tags", []),
            claimant=data.get("claimant"),
            raw_data=data,
            created_at=_parse_datetime(data.get("created_at")),
            updated_at=_parse_datetime(data.get("updated_at")),
            priority=data.get("priority", 0),
        )


@dataclass(frozen=True)
class BifrostTaskDetail(TaskDetail):
    """Bifrost-specific task detail implementation."""

    @staticmethod
    def from_api(data: dict[str, Any]) -> "BifrostTaskDetail":
        """Create a BifrostTaskDetail from API response data."""
        from interface_tasks.types import DependencyRef, NoteEntry, ACEntry, RetroEntry

        task = BifrostTask.from_api(data)

        dependencies = []
        for dep in data.get("dependencies", []):
            dependencies.append(DependencyRef(
                target_id=dep.get("target_id", ""),
                relationship=dep.get("relationship", ""),
            ))

        notes = []
        for note in data.get("notes", []):
            notes.append(NoteEntry(text=note.get("text", "")))

        acceptance_criteria = []
        for ac in data.get("acceptance_criteria", []):
            acceptance_criteria.append(ACEntry(text=ac.get("text", "")))

        retro = []
        for retro_item in data.get("retro", []):
            retro.append(RetroEntry(text=retro_item.get("text", "")))

        return BifrostTaskDetail(
            task=task,
            description=data.get("description"),
            dependencies=dependencies,
            notes=notes,
            acceptance_criteria=acceptance_criteria,
            retro=retro,
        )


def _parse_datetime(dt_str: str | None) -> datetime | None:
    """Parse an ISO datetime string."""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
