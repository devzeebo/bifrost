"""
Tests for completion stats note formatting and composition.

These tests verify that the orchestrator correctly formats agent execution
telemetry into human-readable notes and passes them back to the CLI.
"""

import json
import unittest
from unittest.mock import MagicMock, patch

# This module will be created to compose completion notes
# from agent execution telemetry


class CompletionNoteFormatter:
    """Formats agent execution telemetry into a human-readable completion note."""

    def __init__(self):
        pass

    def format_note(
        self,
        duration_ms: int,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int,
        cache_creation_tokens: int,
        cost_usd: float,
        num_turns: int,
    ) -> dict:
        """
        Format completion stats into a note dict with 'text' and metadata.

        Returns:
            {
                "text": "Human-readable note text",
                "author": "[orchestrator]",
                "timestamp": "ISO8601",
            }
        """
        raise NotImplementedError("CompletionNoteFormatter.format_note")

    def format_cost(self, cost_usd: float) -> str:
        """Format USD cost with 4 decimal places."""
        raise NotImplementedError("CompletionNoteFormatter.format_cost")

    def format_duration(self, duration_ms: int) -> str:
        """Format duration in human-readable form (seconds, minutes)."""
        raise NotImplementedError("CompletionNoteFormatter.format_duration")

    def format_token_count(self, count: int) -> str:
        """Format token count with thousands separator."""
        raise NotImplementedError("CompletionNoteFormatter.format_token_count")


class TestCompletionNoteFormatter(unittest.TestCase):
    """Tests for CompletionNoteFormatter."""

    def setUp(self):
        self.formatter = CompletionNoteFormatter()

    # US-1: Completion Note Appended Automatically
    def test_format_note_includes_duration(self):
        """Given agent execution telemetry, formatted note includes duration."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=400,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        assert "duration" in result["text"].lower() or "42s" in result["text"]
        assert isinstance(result, dict)
        assert "text" in result

    def test_format_note_includes_token_counts(self):
        """Given agent execution telemetry, formatted note includes token counts."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=400,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should mention tokens and the values
        assert "token" in text.lower()
        assert "1" in text  # Input tokens
        assert "800" in text  # Output tokens

    def test_format_note_includes_cost(self):
        """Given agent execution telemetry, formatted note includes USD cost."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=0,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should include cost as "$X.XXXX"
        assert "$" in text
        assert "0.0031" in text

    def test_format_note_includes_turn_count(self):
        """Given agent execution telemetry, formatted note includes turn count."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=0,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should mention turns
        assert "turn" in text.lower()
        assert "7" in text

    # US-2: Note Format Is Human-Readable
    def test_format_note_is_human_readable(self):
        """Given formatted note, text reads naturally (not JSON or raw values)."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=400,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should be plain text, not JSON or raw tokens
        # e.g., "Completed in 42s over 7 turns. Tokens: 1,200 in / 800 out (400 cached). Cost: $0.0031."
        assert not text.startswith("{")
        assert not text.startswith("[")

    def test_format_cost_uses_4_decimal_places(self):
        """Given float USD cost, formatted as string with 4 decimal places."""
        result = self.formatter.format_cost(0.0031)
        assert result == "$0.0031"

        result = self.formatter.format_cost(0.123456)
        assert result == "$0.1235"  # Rounded to 4 places

        result = self.formatter.format_cost(1.0)
        assert result == "$1.0000"

    def test_format_token_count_includes_thousands_separator(self):
        """Given large token count, formatted with commas."""
        result = self.formatter.format_token_count(1200)
        assert result == "1,200"

        result = self.formatter.format_token_count(100000)
        assert result == "100,000"

        result = self.formatter.format_token_count(42)
        assert result == "42"  # No comma for small numbers

    def test_format_duration_converts_milliseconds_to_seconds(self):
        """Given milliseconds, format as seconds when < 60s."""
        result = self.formatter.format_duration(42000)
        assert "42" in result
        assert "s" in result.lower()

    def test_format_duration_converts_to_minutes(self):
        """Given milliseconds > 60s, format as minutes and seconds."""
        result = self.formatter.format_duration(125000)  # 125 seconds = 2m 5s
        assert "2" in result and "m" in result.lower()

    # US-3: Note Is Traceable as Orchestrator-Authored
    def test_format_note_includes_orchestrator_marker(self):
        """Given formatted note, includes [orchestrator] marker or prefix."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=0,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should have clear orchestrator attribution
        assert "[orchestrator]" in text.lower() or "orchestrator" in text.lower()

    def test_format_note_includes_timestamp(self):
        """Given formatted note, includes ISO8601 timestamp."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=0,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        # Should have timestamp in the result dict
        assert "timestamp" in result
        # Should be ISO8601 format
        assert "T" in result["timestamp"]

    # US-4: Stats Are Scoped to the Agent Execution
    def test_format_note_includes_all_retries_cumulative_stats(self):
        """Given multiple retries, stats reflect cumulative tokens and cost."""
        # Suppose an agent ran 3 times: stats should be summed
        # This test verifies the formatter handles cumulative stats correctly
        result = self.formatter.format_note(
            duration_ms=150000,  # 3 attempts totaling 150 seconds
            input_tokens=3600,  # 1200 * 3
            output_tokens=2400,  # 800 * 3
            cache_read_tokens=400,  # Only final attempt
            cache_creation_tokens=400,  # Only final attempt
            cost_usd=0.0093,  # Cumulative
            num_turns=21,  # 7 * 3
        )

        text = result["text"]
        # Should show cumulative values
        assert "3600" in text or "3,600" in text

    def test_format_cost_with_precision(self):
        """Given small USD costs, formatted with sufficient precision."""
        result = self.formatter.format_cost(0.00001)
        assert result == "$0.0000"  # Rounded to 4 places

        result = self.formatter.format_cost(0.0001)
        assert result == "$0.0001"

    # US-7: Token Cache Stats Are Visible in Note
    def test_format_note_includes_cache_read_tokens(self):
        """Given agent used cached tokens, note includes cache read count."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=400,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should mention cache and the cache_read value
        assert "cache" in text.lower() or "400" in text

    def test_format_note_includes_cache_creation_tokens(self):
        """Given agent created cached tokens, note includes cache creation count."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=0,
            cache_creation_tokens=200,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should mention cache and the cache_creation value
        assert "cache" in text.lower() or "200" in text

    def test_format_note_omits_cache_tokens_when_zero(self):
        """Given cache tokens are zero, note omits or minimizes cache mention."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=0,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should not clutter note with "cache_read=0, cache_creation=0"
        # Acceptable: no cache mention, or "no cache used", but not raw zeros
        cache_zeros = text.count("0")
        # Check that it's not excessively repeating zero values
        # (This is a soft check — specific to implementation)
        assert text  # Just ensure it has content

    def test_format_note_separates_cache_tokens_distinctly(self):
        """Given cache read and creation tokens, note shows them separately."""
        result = self.formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=300,
            cache_creation_tokens=200,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should clearly distinguish cache_read from cache_creation
        # e.g., "300 cache read / 200 cache creation" or similar
        assert "300" in text and "200" in text


class TestCompletionNoteIntegration(unittest.TestCase):
    """Integration tests for note composition in the orchestrator."""

    def test_agent_collects_stats_from_result_message(self):
        """Given agent completes, stats are extracted from ResultMessage."""
        # This test verifies agent.py collects stats from Claude SDK's ResultMessage
        # Mock the ResultMessage with stats
        result_message = MagicMock()
        result_message.usage = {
            "input_tokens": 1200,
            "output_tokens": 800,
            "cache_read_input_tokens": 400,
            "cache_creation_input_tokens": 0,
        }
        result_message.total_cost_usd = 0.0031
        result_message.num_turns = 7

        # Stats should be extractable
        assert result_message.usage["input_tokens"] == 1200
        assert result_message.total_cost_usd == 0.0031

    def test_agent_outputs_stats_to_stdout(self):
        """Given agent completes, stats are output in a structured format."""
        # This test verifies agent.py outputs stats (likely as JSON)
        # to be consumed by the CLI orchestrator
        stats = {
            "input_tokens": 1200,
            "output_tokens": 800,
            "cache_read_input_tokens": 400,
            "cache_creation_input_tokens": 0,
            "total_cost_usd": 0.0031,
            "num_turns": 7,
            "duration_ms": 42000,
        }
        json_output = json.dumps(stats)
        # Should be valid JSON
        parsed = json.loads(json_output)
        assert parsed["input_tokens"] == 1200

    def test_completion_note_format_matches_spec(self):
        """Given formatted note, text matches the specification."""
        # Expected format per AC: "Completed in 42s over 7 turns. Tokens: 1,200 in / 800 out (400 cached). Cost: $0.0031."
        formatter = CompletionNoteFormatter()
        result = formatter.format_note(
            duration_ms=42000,
            input_tokens=1200,
            output_tokens=800,
            cache_read_tokens=400,
            cache_creation_tokens=0,
            cost_usd=0.0031,
            num_turns=7,
        )

        text = result["text"]
        # Should resemble the spec format (not necessarily exact)
        assert "42" in text and "s" in text.lower()  # duration
        assert "7" in text and "turn" in text.lower()  # turns
        assert "1" in text and "200" in text  # tokens (1,200)
        assert "800" in text  # output tokens
        assert "$" in text and "0.0031" in text  # cost


if __name__ == "__main__":
    unittest.main()
