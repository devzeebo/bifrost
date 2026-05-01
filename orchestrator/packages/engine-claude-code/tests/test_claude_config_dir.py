"""Test that CLAUDE_CONFIG_DIR is properly used by the Claude Agent SDK."""

import asyncio
import json
import os
import tempfile
from pathlib import Path


async def test_claude_config_dir():
    """Verify CLAUDE_CONFIG_DIR causes SDK to use custom directory for settings/sessions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        claude_dir = Path(tmpdir)

        # Create settings.json in custom directory
        settings_file = claude_dir / "settings.json"
        settings_file.write_text(json.dumps({"custom": "test"}))

        # Set a pre-existing CLAUDE_CONFIG_DIR to verify it gets restored
        original_value = "/original/claude/path"
        os.environ["CLAUDE_CONFIG_DIR"] = original_value

        try:
            from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

            # Simulate what the engine does - set CLAUDE_CONFIG_DIR to custom dir
            claude_dir_for_engine = claude_dir
            os.environ["CLAUDE_CONFIG_DIR"] = str(claude_dir_for_engine)

            options = ClaudeAgentOptions(
                cwd="/tmp",
                permission_mode="dontAsk",
                max_turns=1,
            )

            try:
                async with ClaudeSDKClient(options=options) as client:
                    await client.query("Hello")

                    # Verify sessions were created in custom directory
                    sessions_dir = claude_dir / "sessions"
                    assert sessions_dir.exists(), f"Sessions dir not found at {sessions_dir}"

                    session_files = list(sessions_dir.glob("*.json"))
                    assert len(session_files) > 0, "No session files found"

                    print("✓ CLAUDE_CONFIG_DIR works")
                    print(f"  Sessions created in: {sessions_dir}")
                    print(f"  Session files: {len(session_files)}")
            finally:
                # Simulate engine's cleanup - restore original value
                os.environ["CLAUDE_CONFIG_DIR"] = original_value

            # Verify the original value was restored
            current_value = os.environ.get("CLAUDE_CONFIG_DIR")
            assert current_value == original_value, (
                f"Expected {original_value}, got {current_value}"
            )
            print(f"✓ Original CLAUDE_CONFIG_DIR restored: {current_value}")

        finally:
            os.environ.pop("CLAUDE_CONFIG_DIR", None)


if __name__ == "__main__":
    asyncio.run(test_claude_config_dir())
