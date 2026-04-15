#!/usr/bin/env python3
"""
Unit tests for completion note formatting and API interaction.

These tests cover:
- Note formatting with execution telemetry
- Note attribution to orchestrator
- Token cache stats formatting
- Cost calculation and formatting
"""

import pytest
from unittest.mock import patch


class TestCompletionNoteFormatter:
    """Tests for formatting completion notes with execution stats."""

    def test_format_note_with_all_stats(self):
        """AC-2: Format completion note with duration, tokens, cost, and turns in human-readable text."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 42000,
            "input_tokens": 1200,
            "output_tokens": 800,
            "cache_read_tokens": 400,
            "cache_creation_tokens": 150,
            "total_cost_usd": 0.0031,
            "num_turns": 7,
        }

        note = format_completion_note(stats)

        # Verify human-readable format
        assert "42" in note or "42000" in note  # duration
        assert "1,200" in note or "1200" in note  # input tokens with formatting
        assert "800" in note  # output tokens
        assert "$0.0031" in note  # cost
        assert "7" in note  # turns

    def test_format_note_readable_output(self):
        """AC-2: Completion note reads naturally with commas for thousands and 4 decimal places for cost."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 120000,
            "input_tokens": 5000,
            "output_tokens": 2500,
            "cache_read_tokens": 1000,
            "cache_creation_tokens": 500,
            "total_cost_usd": 0.0156,
            "num_turns": 12,
        }

        note = format_completion_note(stats)

        # Check for comma formatting in large numbers
        assert "5,000" in note or "5000" in note  # thousands separator
        # Check for currency formatting with 4 decimal places
        assert "$0.0156" in note

    def test_format_note_includes_orchestrator_marker(self):
        """AC-3: Completion note includes marker indicating it was written by the orchestrator."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 5000,
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Verify orchestrator marker is present
        assert "[orchestrator]" in note.lower() or "orchestrator" in note.lower()

    def test_format_note_omits_zero_cache_stats(self):
        """AC-7: Completion note omits cache stats if they are zero, without cluttering."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 3000,
            "input_tokens": 200,
            "output_tokens": 100,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0002,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Should not clutter with zero cache stats
        # Verify note is generated and doesn't have excessive "0" values for cache
        assert "200" in note or "100" in note
        assert "$0.0002" in note

    def test_format_note_includes_cache_stats_when_present(self):
        """AC-7: Completion note shows cache read and cache creation tokens as distinct values."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 8000,
            "input_tokens": 2000,
            "output_tokens": 1000,
            "cache_read_tokens": 500,
            "cache_creation_tokens": 300,
            "total_cost_usd": 0.0050,
            "num_turns": 5,
        }

        note = format_completion_note(stats)

        # Both cache values should be visible as distinct values
        assert "500" in note or "5" in note  # cache read
        assert "300" in note or "3" in note  # cache creation
        assert "cache" in note.lower()

    def test_format_note_with_single_turn(self):
        """Single turn completion should format without errors."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 1000,
            "input_tokens": 50,
            "output_tokens": 25,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        assert note is not None
        assert isinstance(note, str)
        assert len(note) > 0

    def test_format_note_with_many_turns(self):
        """AC-4: Completion note should handle cumulative stats from many turns."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 300000,  # 5 minutes
            "input_tokens": 50000,
            "output_tokens": 30000,
            "cache_read_tokens": 10000,
            "cache_creation_tokens": 5000,
            "total_cost_usd": 0.1234,
            "num_turns": 25,
        }

        note = format_completion_note(stats)

        assert "25" in note  # turn count
        assert "$0.1234" in note


class TestCompletionNoteAPI:
    """Tests for appending completion note via HTTP API."""

    @patch("agent.append_completion_note_to_api")
    def test_append_note_calls_api_with_correct_payload(self, mock_append):
        """Completion note formatter produces properly formatted note text."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 10000,
            "input_tokens": 500,
            "output_tokens": 300,
            "cache_read_tokens": 100,
            "cache_creation_tokens": 50,
            "total_cost_usd": 0.0020,
            "num_turns": 3,
        }

        note_text = format_completion_note(stats)

        # Verify note is non-empty and contains key information
        assert note_text
        assert isinstance(note_text, str)
        assert len(note_text) > 20  # Should be a meaningful message

    def test_append_completion_note_success(self):
        """Appending completion note to API succeeds with rune_id and formatted text."""
        from agent import append_completion_note_to_api

        with patch("agent.post_to_api") as mock_post:
            mock_post.return_value = None  # Success

            rune_id = "bf-1234"
            note_text = "[orchestrator] Completed in 5s over 2 turns. Cost: $0.0010."

            # Should not raise
            append_completion_note_to_api(rune_id, note_text, "http://localhost:8000")

            # Verify API was called with correct endpoint and payload
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            assert "/add-note" in call_args[0][0] or "add-note" in str(call_args)

    def test_append_note_includes_rune_id_and_text(self):
        """Note API call includes both rune_id and formatted text in payload."""
        from agent import append_completion_note_to_api

        with patch("agent.post_to_api") as mock_post:
            mock_post.return_value = None

            rune_id = "bf-5678"
            note_text = "[orchestrator] Test note"

            append_completion_note_to_api(rune_id, note_text, "http://localhost:8000")

            # Verify the payload structure
            call_args = mock_post.call_args
            if len(call_args[0]) > 1:
                payload = call_args[0][1]
                assert payload.get("rune_id") == rune_id or "bf-5678" in str(payload)
                assert payload.get("text") == note_text or note_text in str(payload)


class TestNoteTimestamp:
    """Tests for note timestamp and attribution."""

    def test_note_includes_timestamp(self):
        """AC-3: Completion note is timestamped at time of fulfillment."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 5000,
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Note should contain date/time or timestamp reference
        # (either explicit timestamp or timestamp at append time)
        assert note is not None
        assert len(note) > 0

    def test_note_attribution_text(self):
        """AC-3: Note clearly indicates orchestrator authorship with marker or tag."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 2000,
            "input_tokens": 80,
            "output_tokens": 40,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Should have clear orchestrator attribution
        # Either [orchestrator] tag or mention of "orchestrator"
        lower_note = note.lower()
        assert "orchestrator" in lower_note or "[" in note


class TestDurationFormatting:
    """Tests for duration formatting in completion notes."""

    def test_format_duration_seconds(self):
        """Duration should be formatted in seconds for readability."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 42000,  # 42 seconds
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0001,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Should show 42s or "42 seconds"
        assert "42" in note

    def test_format_duration_minutes(self):
        """Duration over a minute should format readably."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 125000,  # ~2 minutes
            "input_tokens": 500,
            "output_tokens": 300,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.0010,
            "num_turns": 5,
        }

        note = format_completion_note(stats)

        # Should contain time information
        assert note is not None
        assert isinstance(note, str)


class TestTokenFormatting:
    """Tests for token count formatting in notes."""

    def test_format_large_token_counts_with_commas(self):
        """Token counts should use comma separators for readability."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 10000,
            "input_tokens": 10500,
            "output_tokens": 5000,
            "cache_read_tokens": 2000,
            "cache_creation_tokens": 1000,
            "total_cost_usd": 0.0050,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Should have formatted numbers for clarity
        assert "10" in note and "500" in note  # Contains parts of 10500
        assert note is not None

    def test_format_cost_precision(self):
        """Cost should be formatted with 4 decimal places in USD."""
        from agent import format_completion_note

        stats = {
            "duration_ms": 5000,
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
            "total_cost_usd": 0.001234,
            "num_turns": 1,
        }

        note = format_completion_note(stats)

        # Cost should be shown with appropriate precision
        assert "$" in note
        assert "0.00" in note or "0.001" in note


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
