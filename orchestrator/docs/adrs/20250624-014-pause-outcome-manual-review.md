# 20250624-014. Pause Outcome for Manual Review

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Some agent workflows require human intervention before completion. Examples: code review, security approval, manual verification. Framework needs to pause task execution without failing it, allowing external systems to resume later.

## Decision

Add `pause` outcome to HookResult. Stop hooks can return `pause` with message. Orchestrator calls `TaskSource.pauseTask()` and exits with `paused` outcome. Task remains in system for later resumption.

```typescript
export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip" | "pause";
  message?: string;
};

// Stop hook triggering pause
if (await needsManualReview()) {
  return {
    outcome: "pause",
    message: "Awaiting manual security review before deployment",
  };
}

// Orchestrator handling
if (hook.outcome === "pause") {
  await taskSource.pauseTask(task.id);
  return { outcome: "paused", pauseReason: hook.message };
}

// TaskSource interface
export type TaskSource = {
  pauseTask: (taskId: string) => Promise<void>;
  // ...
};
```

## Consequences

**Positive:**

- Enables human-in-the-loop workflows
- Task state preserved for resumption
- Clear reason provided via message
- No task failure (distinct from `fatal`)

**Negative:**

- No hook-level pause (only Stop hooks)
- No automatic resume mechanism
- External system must handle resume logic
- Pause duration not tracked

## Changelog

- Add pause outcome to HookResult for manual review workflows
