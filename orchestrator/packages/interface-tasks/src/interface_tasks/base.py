"""Abstract task source interface for task providers."""

from abc import ABC, abstractmethod
from typing import AsyncIterator


class TaskSource(ABC):
    """Abstract interface for task sources.

    A task source provides tasks (runes) to the orchestrator,
    handles claiming/unclaiming, and reports completion.
    """

    @abstractmethod
    async def watch_tasks(self) -> AsyncIterator["Task"]:
        """Watch for ready tasks and yield them as they become available.

        Yields:
            Task objects that are ready for execution
        """
        pass

    @abstractmethod
    async def get_task_detail(self, task_id: str) -> "TaskDetail":
        """Get detailed information about a task.

        Args:
            task_id: Unique task identifier

        Returns:
            TaskDetail with full task information
        """
        pass

    @abstractmethod
    async def claim_task(self, task_id: str, claimant: str) -> bool:
        """Claim a task for execution.

        Args:
            task_id: Unique task identifier
            claimant: Identifier for the claimant (e.g., worker ID)

        Returns:
            True if task was successfully claimed
        """
        pass

    @abstractmethod
    async def unclaim_task(self, task_id: str) -> bool:
        """Unclaim a task.

        Args:
            task_id: Unique task identifier

        Returns:
            True if task was successfully unclaimed
        """
        pass

    @abstractmethod
    async def complete_task(self, task_id: str) -> bool:
        """Mark a task as completed.

        Args:
            task_id: Unique task identifier

        Returns:
            True if task was successfully marked complete
        """
        pass
