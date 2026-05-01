"""Factory functions for creating task sources and engines from configuration."""

from interface_tasks import TaskSource
from interface_engine import Engine

from orchestrator.core.config import TaskSourceConfig, EngineConfig


def create_task_source(config: TaskSourceConfig) -> TaskSource:
    """Create a task source from configuration.

    Args:
        config: TaskSourceConfig with type and settings

    Returns:
        TaskSource instance

    Raises:
        ValueError: if task source type is unknown
    """
    if config.type == "bifrost":
        from tasks_bifrost import BifrostTaskSourceConfig, BifrostTaskSource

        bifrost_config = BifrostTaskSourceConfig.from_dict({
            "type": config.type,
            "settings": config.settings,
        })

        return BifrostTaskSource(
            base_url=bifrost_config.base_url,
            timeout=bifrost_config.timeout,
            poll_interval=bifrost_config.poll_interval,
        )
    else:
        raise ValueError(f"Unknown task source type: {config.type}")


def create_engine(config: EngineConfig, agent_entry) -> Engine:
    """Create an engine from configuration.

    Args:
        config: EngineConfig with type and settings
        agent_entry: AgentEntry from the agent catalog (contains model, tools, prompt)

    Returns:
        Engine instance

    Raises:
        ValueError: if engine type is unknown
    """
    if config.type == "claude-code":
        from engine_claude_code import ClaudeCodeEngineConfig, ClaudeCodeEngine

        engine_config = ClaudeCodeEngineConfig.from_dict({
            "type": config.type,
            "settings": config.settings,
        })

        return ClaudeCodeEngine(
            entry=agent_entry,
            verbose=engine_config.verbose,
            claude_dir=engine_config.claude_dir,
        )
    else:
        raise ValueError(f"Unknown engine type: {config.type}")
