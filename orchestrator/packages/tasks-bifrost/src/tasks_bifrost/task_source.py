"""Bifrost task source implementation."""

import asyncio
import logging
from typing import AsyncIterator

from interface_tasks import TaskSource, TaskDetail

from tasks_bifrost.api_client import BifrostAPIClient
from tasks_bifrost.models import BifrostTask, BifrostTaskDetail

logger = logging.getLogger(__name__)


class BifrostTaskSource(TaskSource):
    """Task source that polls the Bifrost API for ready runes."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        timeout: int = 30,
        poll_interval: int = 10,
    ) -> None:
        """Initialize the Bifrost task source.

        Args:
            base_url: Base URL of the Bifrost API server
            timeout: Request timeout in seconds
            poll_interval: Seconds between poll attempts (default 10)
        """
        self.api_client = BifrostAPIClient(base_url=base_url, timeout=timeout)
        self.poll_interval = poll_interval
        self._seen_runes: set[str] = set()

    async def watch_tasks(self) -> AsyncIterator[BifrostTask]:
        """Watch for ready tasks and yield them as they become available.

        Yields:
            BifrostTask objects that are ready for execution
        """
        while True:
            try:
                # Run the blocking API call in a thread pool
                loop = asyncio.get_event_loop()
                runes_data = await loop.run_in_executor(
                    None, self.api_client.fetch_ready_runes, self.saga
                )

                for rune_data in runes_data:
                    rune_id = rune_data.get("id")
                    if not rune_id:
                        continue

                    # Skip if already claimed by someone else
                    if rune_data.get("claimant"):
                        continue

                    # Skip if we've already yielded this rune
                    if rune_id in self._seen_runes:
                        continue

                    self._seen_runes.add(rune_id)
                    task = BifrostTask.from_api(rune_data)
                    logger.info("Found ready task: %s", task.id)
                    yield task

            except Exception as exc:
                logger.error("Error polling for ready tasks: %s", exc)

            await asyncio.sleep(self.poll_interval)

    async def get_task_detail(self, task_id: str) -> BifrostTaskDetail:
        """Get detailed information about a task.

        Args:
            task_id: Unique task identifier

        Returns:
            BifrostTaskDetail with full task information
        """
        loop = asyncio.get_event_loop()
        detail_data = await loop.run_in_executor(
            None, self.api_client.fetch_rune_detail, task_id
        )

        if not detail_data:
            raise ValueError(f"Task {task_id} not found")

        return BifrostTaskDetail.from_api(detail_data)

    async def claim_task(self, task_id: str, claimant: str) -> bool:
        """Claim a task for execution.

        Args:
            task_id: Unique task identifier
            claimant: Identifier for the claimant

        Returns:
            True if task was successfully claimed
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.api_client.claim_rune, task_id, claimant
        )

    async def unclaim_task(self, task_id: str) -> bool:
        """Unclaim a task.

        Args:
            task_id: Unique task identifier

        Returns:
            True if task was successfully unclaimed
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, self.api_client.unclaim_rune, task_id
        )
        # Remove from seen set so we can pick it up again
        self._seen_runes.discard(task_id)
        return result

    async def complete_task(self, task_id: str) -> bool:
        """Mark a task as completed.

        Args:
            task_id: Unique task identifier

        Returns:
            True if task was successfully marked complete
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, self.api_client.fulfill_rune, task_id
        )
        # Remove from seen set
        self._seen_runes.discard(task_id)
        return result
