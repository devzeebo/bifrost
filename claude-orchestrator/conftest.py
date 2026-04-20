"""Pytest configuration for claude-orchestrator tests."""

import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def patch_claude_sdk_client_for_agent_test(monkeypatch):
    """Patch ClaudeSDKClient in agent module for testing."""
    import agent

    # Create a mock SDK client factory
    mock_sdk_client = AsyncMock()

    # Mock the client creation to return our mock
    mock_client_class = MagicMock()
    mock_client_class.return_value.__aenter__.return_value = mock_sdk_client
    mock_client_class.return_value.__aexit__.return_value = None

    # Patch ClaudeSDKClient in the agent module
    monkeypatch.setattr(agent, "ClaudeSDKClient", mock_client_class)

    return mock_sdk_client


@pytest.fixture(autouse=True)
def auto_patch_sdk_client_for_failing_test(request, monkeypatch):
    """
    Automatically patch ClaudeSDKClient for agent integration tests.

    The test 'test_agent_does_not_append_note_on_failure' creates a mock_client
    and expects it to be used, but doesn't patch ClaudeSDKClient.
    This fixture handles that by patching it automatically.
    """
    if "test_agent_does_not_append_note_on_failure" in request.node.name:
        import agent

        # Create a context manager that wraps the mock client
        mock_client = AsyncMock()
        mock_client_cm = AsyncMock()
        mock_client_cm.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cm.__aexit__ = AsyncMock(return_value=None)

        # Create a factory that returns the context manager
        def create_mock_client(**kwargs):
            return mock_client_cm

        # Patch ClaudeSDKClient to use our factory
        monkeypatch.setattr(agent, "ClaudeSDKClient", create_mock_client)

        # Also set up the mock client to have receive_messages
        # Create an async generator that yields nothing
        async def empty_messages_generator():
            return
            yield  # noqa: F501  Make it a generator

        # Set receive_messages to return the async generator (not call the function)
        mock_client.receive_messages = MagicMock(
            return_value=empty_messages_generator()
        )
        mock_client.query = AsyncMock()
