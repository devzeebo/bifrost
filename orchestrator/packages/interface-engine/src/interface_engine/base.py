"""Abstract engine interface for task execution engines."""

from abc import ABC, abstractmethod
from interface_engine.types import EngineContext, EngineResult


class Engine(ABC):
    """Abstract interface for task execution engines.

    An engine takes a task (rune) and executes it using some underlying
    execution mechanism (e.g., Claude Code CLI, generic agent, etc.).
    """

    @abstractmethod
    async def execute(self, context: EngineContext, task_data: dict) -> EngineResult:
        """Execute a task and return the result.

        Args:
            context: Execution context (task_id, working_dir, agent_name, verbose)
            task_data: Raw task data (rune detail, description, etc.)

        Returns:
            EngineResult with success status, skip_fulfill flag, and stats
        """
        pass

    @abstractmethod
    def supports_agent(self, agent_name: str) -> bool:
        """Check if this engine supports the given agent.

        Args:
            agent_name: Name of the agent to check

        Returns:
            True if this engine can execute the agent
        """
        pass
