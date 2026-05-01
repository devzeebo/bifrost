"""Completion note formatting and Bifrost API posting."""

from __future__ import annotations

import logging

from interface_engine.types import ExecutionStats

logger = logging.getLogger(__name__)


def format_completion_note(stats: ExecutionStats | dict) -> str:
    """Format a human-readable completion note from execution statistics."""
    if isinstance(stats, dict):
        stats = ExecutionStats(
            duration_ms=stats.get("duration_ms", 0),
            input_tokens=stats.get("input_tokens", 0),
            output_tokens=stats.get("output_tokens", 0),
            cache_read_tokens=stats.get("cache_read_tokens", 0),
            cache_creation_tokens=stats.get("cache_creation_tokens", 0),
            total_cost_usd=stats.get("total_cost_usd", 0.0),
            num_turns=stats.get("num_turns", 0),
        )
    duration_ms = stats.duration_ms
    duration_s = duration_ms / 1000.0

    if duration_s < 1:
        duration_str = f"{duration_ms:.0f}ms"
    elif duration_s < 60:
        duration_str = f"{duration_s:.1f}s"
    elif duration_s < 3600:
        duration_str = f"{duration_s / 60:.1f}m"
    else:
        duration_str = f"{duration_s / 3600.0:.1f}h"

    num_turns = stats.num_turns
    input_str = f"{stats.input_tokens:,}"
    output_str = f"{stats.output_tokens:,}"
    cost_str = f"${stats.total_cost_usd:.4f}"

    parts = [
        f"(orchestrator) Completed in {duration_str} over {num_turns} turn{'s' if num_turns != 1 else ''}.",
        f"Tokens: {input_str} input, {output_str} output.",
    ]

    cache_parts = []
    if stats.cache_read_tokens > 0:
        cache_parts.append(f"{stats.cache_read_tokens:,} cache read")
    if stats.cache_creation_tokens > 0:
        cache_parts.append(f"{stats.cache_creation_tokens:,} cache creation")
    if cache_parts:
        parts.append(f"Cache: {', '.join(cache_parts)}.")

    parts.append(f"Cost: {cost_str}.")
    return " ".join(parts)


class BifrostAPIClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def append_completion_note(self, rune_id: str, stats: ExecutionStats) -> None:
        """Post a formatted completion note to the Bifrost API."""
        note_text = format_completion_note(stats)
        url = f"{self.base_url}/api/add-note"
        payload = {"rune_id": rune_id, "text": note_text}
        try:
            import requests

            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
        except Exception as exc:
            logger.warning("Failed to POST completion note to %s: %s", url, exc)
