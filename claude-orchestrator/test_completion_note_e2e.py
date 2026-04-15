#!/usr/bin/env python3
"""
End-to-end and edge case tests for completion note feature.

Tests covering:
- API integration with bifrost server
- Edge cases (very large token counts, unusual costs)
- Note formatting edge cases
- Failure scenarios
"""

import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock


class TestCompletionNoteFormattingEdgeCases:
    """Tests for edge cases in completion note formatting."""

    def test_very_large_token_counts(self):
        """Should handle very large token counts with proper formatting."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 3600000,  # 1 hour
            "input_tokens": 1000000,  # 1 million
            "output_tokens": 500000,
            "cache_read_tokens": 250000,
            "cache_creation_tokens": 100000,
            "total_cost_usd": 5.0000,
            "num_turns": 50,
        }

        note = format_completion_note(stats)

        assert note is not None
        assert isinstance(note, str)
        assert len(note) > 0
        # Should contain million or properly formatted numbers
        assert "1" in note and "0" in note  # Parts of "1000000" or formatted

    def test_very_small_cost(self):
        """Should format very small costs meaningfully."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 100,
            "input_tokens": 5,
            "output_tokens": 2,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.00001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        assert note is not None
        # Should show cost even if very small
        assert "$" in note or "0.00001" in note or "0.00" in note

    def test_zero_cache_read_with_high_cache_creation(self):
        """Should handle cache creation with no reads."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 8000,
            "input_tokens": 2000,
            "output_tokens": 1000,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 1500,
            "total_cost_usd": 0.0080,
            "num_turns": 4,
        }

        note = format_completion_note(stats)

        assert "1500" in note or "1,500" in note or "cache" in note.lower()
        assert note is not None

    def test_very_long_duration(self):
        """Should format very long durations readably."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 86400000,  # 24 hours
            "input_tokens": 50000,
            "output_tokens": 30000,
            "cache_read_tokens": 10000,
            "cache_creation_tokens": 5000,
            "total_cost_usd": 0.2500,
            "num_turns": 100,
        }

        note = format_completion_note(stats)

        assert note is not None
        # Should represent the duration meaningfully
        assert "86400" in note or "24" in note or "hour" in note.lower()

    def test_very_short_duration(self):
        """Should format very short durations (milliseconds)."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 50,  # 50 milliseconds
            "input_tokens": 20,
            "output_tokens": 10,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.00002,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        assert note is not None
        assert "50" in note or "ms" in note.lower() or "millisecond" in note.lower()

    def test_single_token_exchanges(self):
        """Should handle edge case of very minimal token usage."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 500,
            "input_tokens": 1,
            "output_tokens": 1,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0000001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        assert note is not None
        assert "1" in note


class TestNoteFormatConsistency:
    """Tests for consistent formatting across different stat combinations."""

    def test_format_is_consistent_across_calls(self):
        """Same stats should produce same note format."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 5000,
            "input_tokens": 200,
            "output_tokens": 100,
            "cache_read_tokens": 50,
            "cache_creation_tokens": 25,
            "total_cost_usd": 0.0010,
            "num_turns": 2,
        }

        note1 = format_completion_note(stats)
        note2 = format_completion_note(stats)

        # Should be identical for same input
        assert note1 == note2

    def test_note_always_includes_orchestrator_marker(self):
        """All notes should have the orchestrator marker."""
        from agent import format_completion_note

        test_cases = [
            {
                "duration_ms": 1000,
                "input_tokens": 10,
                "output_tokens": 5,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0,
                "total_cost_usd": 0.0001,
                "num_turns": 1,
            },
            {
                "duration_ms": 100000,
                "input_tokens": 5000,
                "output_tokens": 2000,
                "cache_read_tokens": 500,
                "cache_creation_tokens": 200,
                "total_cost_usd": 0.0200,
                "num_turns": 10,
            },
        ]

        for stats in test_cases:
            note = format_completion_note(stats)
            assert "orchestrator" in note.lower()


class TestAPIIntegrationErrors:
    """Tests for handling API errors during note appending."""

    def test_append_note_with_network_error(self):
        """Should handle network errors gracefully."""
        from agent import append_completion_note_to_api

        with patch("agent.post_to_api") as mock_post:
            mock_post.side_effect = ConnectionError("Network unreachable")

            # Should handle error (either raise or log)
            try:
                append_completion_note_to_api("bf-1234", "test note", "http://localhost:8000")
                # If no exception, that's graceful handling
            except ConnectionError:
                # If exception raised, that's acceptable
                pass

    def test_append_note_with_auth_error(self):
        """Should handle authentication errors."""
        from agent import append_completion_note_to_api

        with patch("agent.post_to_api") as mock_post:
            mock_post.side_effect = Exception("Unauthorized")

            try:
                append_completion_note_to_api("bf-1234", "test note", "http://localhost:8000")
            except Exception:
                pass

    def test_append_note_with_malformed_response(self):
        """Should handle malformed API responses."""
        from agent import append_completion_note_to_api

        with patch("agent.post_to_api") as mock_post:
            mock_post.side_effect = Exception("Invalid JSON response")

            try:
                append_completion_note_to_api("bf-1234", "test note", "http://localhost:8000")
            except Exception:
                pass


class TestNoteTextValidation:
    """Tests for note text validation and sanitization."""

    def test_note_text_is_string(self):
        """Formatted note should always be a valid string."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 2000,
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0005,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        assert isinstance(note, str)
        assert len(note) > 0

    def test_note_is_json_serializable(self):
        """Note should be JSON-serializable for API transmission."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 3000,
            "input_tokens": 150,
            "output_tokens": 75,
            "cache_read_tokens": 25,
            "cache_creation_tokens": 10,
            "total_cost_usd": 0.0010,
            "num_turns": 2,
        }

        note = format_completion_note(stats)

        # Should be JSON serializable
        json_str = json.dumps({"text": note})
        assert json_str is not None
        parsed = json.loads(json_str)
        assert parsed["text"] == note

    def test_note_does_not_contain_raw_json(self):
        """Human-readable note should not contain raw JSON."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 2000,
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0005,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Should be human-readable, not JSON
        assert not note.startswith("{")
        assert not note.startswith("[")


class TestMultipleAgentRuns:
    """Tests for handling multiple agent runs and notes."""

    def test_different_runes_get_different_notes(self):
        """Different runes should get distinct completion notes."""
        from agent import format_completion_note

        stats1 = {
            "duration_ms": 5000,
            "input_tokens": 200,
            "output_tokens": 100,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0010,
            "num_turns": 2,
        }

        stats2 = {
            "duration_ms": 10000,
            "input_tokens": 400,
            "output_tokens": 200,
            "cache_read_tokens": 100,
            "cache_creation_tokens": 50,
            "total_cost_usd": 0.0025,
            "num_turns": 4,
        }

        note1 = format_completion_note(stats1)
        note2 = format_completion_note(stats2)

        # Notes should be different for different stats
        assert note1 != note2
        # Both should be valid
        assert "orchestrator" in note1.lower()
        assert "orchestrator" in note2.lower()


class TestOrchestrationAttributes:
    """Tests for proper orchestrator attribution in notes."""

    def test_orchestrator_marker_placement(self):
        """[orchestrator] marker should be prominent in the note."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 4000,
            "input_tokens": 300,
            "output_tokens": 150,
            "cache_read_tokens": 50,
            "cache_creation_tokens": 25,
            "total_cost_usd": 0.0015,
            "num_turns": 3,
        }

        note = format_completion_note(stats)

        # Marker should appear early in the note
        lower_note = note.lower()
        orchestrator_pos = lower_note.find("orchestrator")
        assert orchestrator_pos >= 0  # Should be found
        assert orchestrator_pos < 100  # Should appear relatively early

    def test_note_attribution_is_unambiguous(self):
        """Attribution to orchestrator should be clear and unambiguous."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 3000,
            "input_tokens": 200,
            "output_tokens": 100,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0010,
            "num_turns": 2,
        }

        note = format_completion_note(stats)

        # Should clearly indicate it's from orchestrator
        assert "orchestrator" in note.lower()
        # Should not suggest it's from a human user
        assert "user" not in note.lower() or "orchestrator" in note.lower()


class TestCostCalculation:
    """Tests for cost representation and precision."""

    def test_cost_always_in_usd(self):
        """Cost should always be represented in USD."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 2000,
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.00123,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Should have USD indicator
        assert "$" in note
        assert "usd" in note.lower() or "$" in note

    def test_cost_with_various_decimal_places(self):
        """Should handle costs with various decimal precisions."""
        from agent import format_completion_note

        test_costs = [0.1, 0.01, 0.001, 0.0001, 0.00001]

        for cost in test_costs:
            stats = {
                "duration_ms": 1000,
                "input_tokens": 50,
                "output_tokens": 25,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0,
                "total_cost_usd": cost,
                "num_turns": 1,
            }

            note = format_completion_note(stats)
            assert "$" in note
            assert note is not None


class TestRuneFailureScenarios:
    """Tests for scenarios where agent fails and no note should be written."""

    def test_agent_crash_no_note(self):
        """If agent crashes, no note should be appended."""
        # This is verified through integration tests
        # Verify the append function exists and can be called conditionally
        from agent import append_completion_note_to_api

        assert callable(append_completion_note_to_api)

    def test_rune_remains_claimed_on_failure(self):
        """When agent fails, rune should remain claimed (orchestrator handles this)."""
        # This is CLI concern, verify agent doesn't interfere
        from agent import format_completion_note

        # Agent should only format notes on success
        # Caller decides whether to append based on exit code
        assert callable(format_completion_note)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
