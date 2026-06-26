# 20250624-002. AsyncGenerator Task Streaming

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Orchestrator needs to consume tasks continuously as they become available. Tasks may arrive over time from external systems (Bifrost API) or be generated dynamically. Polling-based approaches add latency and complexity. Bifrost API is REST-based (not streaming), so task source must bridge this gap.

## Decision

Use AsyncGenerator pattern for `TaskSource.watchTasks()`. Orchestrator iterates via `for await` loop, pulling tasks as they become available. Each task source implementation decides how to handle streaming - orchestrator remains unaware of polling vs. true streaming.

```typescript
// TaskSource interface
export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>; // Returns async generator
  // ...
};

// Orchestrator consumption (streaming-agnostic)
export class Orchestrator {
  public async run(): Promise<void> {
    for await (const task of this.taskSource.watchTasks()) {
      // Process task
    }
  }
}
```

**BifrostTaskSource implementation:**
Bifrost API doesn't support streaming. Task source wraps polling loop in async generator:

- Polls `getReadyRunes()` endpoint repeatedly
- Adaptive backoff: 1s base, doubles to 30s max when idle
- Resets to 1s when tasks found (rapid response during active periods)
- Adds jitter (±20%) to prevent thundering herd
- Yields each task as claimed, maintaining AsyncGenerator contract

```typescript
public async *watchTasks(): AsyncGenerator<Task> {
  let pollInterval = 1000;  // Start at 1s
  const maxInterval = 30000; // Cap at 30s

  while (true) {
    const readyRunes = await client.getReadyRunes();

    if (readyRunes.length > 0) {
      pollInterval = 1000; // Reset when tasks found
    } else {
      pollInterval = Math.min(pollInterval * 2, maxInterval); // Backoff
    }

    for (const rune of readyRunes) {
      await client.claimRune(rune.id);
      yield mapToTask(rune); // Yield each task
    }

    const jitter = pollInterval * 0.2 * (Math.random() * 2 - 1);
    await sleep(pollInterval + jitter);
  }
}
```

## Consequences

**Positive:**

- Natural streaming syntax (`for await`)
- Task source controls timing/batching
- Backpressure handling built-in (orchestrator pulls next task)
- Cancellation via `break` or `return`
- Supports infinite streams (continuous operation)
- Each implementation optimizes for its backend (polling vs. websocket vs. SSE)
- Orchestrator unaware of streaming strategy
- Adaptive polling balances responsiveness vs. load
- Jitter prevents synchronized requests across instances

**Negative:**

- AsyncGenerator less familiar than callbacks/events
- Error handling requires try/catch around generator
- Polling implementations add delay (1s in Bifrost case)
- Polling generates load during idle periods

## Changelog

- Use AsyncGenerator pattern for task streaming via TaskSource.watchTasks()
