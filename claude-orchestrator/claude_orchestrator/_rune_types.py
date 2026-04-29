# AUTO-GENERATED — do not edit by hand.
# Run scripts/gen_rune_types.py to regenerate from Go source.
#
# Source: bifrost/domain/projectors/rune_detail.go
#         bifrost/domain/projectors/rune_retro_projector.go

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


def _parse_dt(v: str | None) -> datetime:
    if not v:
        return datetime(1970, 1, 1, tzinfo=timezone.utc)
    if isinstance(v, datetime):
        return v
    return datetime.fromisoformat(v.replace("Z", "+00:00"))


@dataclass(frozen=True)
class DependencyRef:
    target_id: str
    relationship: str

    @classmethod
    def from_dict(cls, raw: dict) -> "DependencyRef":
        return cls(
            target_id=raw.get("target_id") or "",
            relationship=raw.get("relationship") or "",
        )


@dataclass(frozen=True)
class NoteEntry:
    text: str
    created_at: datetime

    @classmethod
    def from_dict(cls, raw: dict) -> "NoteEntry":
        return cls(
            text=raw.get("text") or "",
            created_at=_parse_dt(raw.get("created_at")),
        )


@dataclass(frozen=True)
class ACEntry:
    id: str
    scenario: str
    description: str

    @classmethod
    def from_dict(cls, raw: dict) -> "ACEntry":
        return cls(
            id=raw.get("id") or "",
            scenario=raw.get("scenario") or "",
            description=raw.get("description") or "",
        )


@dataclass(frozen=True)
class RetroEntry:
    text: str
    created_at: datetime

    @classmethod
    def from_dict(cls, raw: dict) -> "RetroEntry":
        return cls(
            text=raw.get("text") or "",
            created_at=_parse_dt(raw.get("created_at")),
        )


@dataclass(frozen=True)
class RuneDetail:
    id: str
    title: str
    description: str
    status: str
    priority: int
    claimant: str
    parent_id: str
    branch: str
    tags: list[str]
    type: str
    dependencies: list[DependencyRef]
    notes: list[NoteEntry]
    retro_items: list[RetroEntry]
    acceptance_criteria: list[ACEntry]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_dict(cls, raw: dict) -> "RuneDetail":
        return cls(
            id=raw.get("id") or "",
            title=raw.get("title") or "",
            description=raw.get("description") or "",
            status=raw.get("status") or "",
            priority=raw.get("priority") or 0,
            claimant=raw.get("claimant") or "",
            parent_id=raw.get("parent_id") or "",
            branch=raw.get("branch") or "",
            tags=list(raw.get("tags") or []),
            type=raw.get("type") or "",
            dependencies=[DependencyRef.from_dict(v) for v in (raw.get("dependencies") or [])],
            notes=[NoteEntry.from_dict(v) for v in (raw.get("notes") or [])],
            retro_items=[RetroEntry.from_dict(v) for v in (raw.get("retro_items") or [])],
            acceptance_criteria=[ACEntry.from_dict(v) for v in (raw.get("acceptance_criteria") or [])],
            created_at=_parse_dt(raw.get("created_at")),
            updated_at=_parse_dt(raw.get("updated_at")),
        )


# Public alias — import as Rune throughout the package
Rune = RuneDetail
