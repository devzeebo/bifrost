# 20250624-007. Outcome-Based Flow Control

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Hooks need to control orchestration flow. Examples: Skip already-completed work, abort on validation failure, pause for manual review. Framework needs structured way for hooks to influence execution.

## Decision

Hooks return `HookResult` with `outcome` field. Orchestrator checks outcomes and responds accordingly. Outcomes: `success` (continue), `fatal` (abort), `skip` (complete without running engine), `pause` (pause task), `follow-up` (retry).

```typescript
export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip" | "pause";
  message?: string;
};

// Orchestrator response to outcomes
if (result.outcome === "fatal") {
  await taskSource.failTask(task.id, `Hook failed: ${result.message}`);
  return { outcome: "failed" };
}

if (result.outcome === "skip") {
  await taskSource.completeTask(task.id);
  return { outcome: "skipped" };
}

if (result.outcome === "pause") {
  await taskSource.pauseTask(task.id);
  return { outcome: "paused" };
}
```

## Consequences

**Positive:**

- Clear flow control via enum
- Hooks influence execution without throwing
- Message field provides context
- Extensible (add new outcomes later)
- Consistent across Start/Stop hooks

**Negative:**

- Fatal outcome stops hook chain immediately
- Only one follow-up message (last wins)
- No "warning" outcome (log but continue)
- Outcomes mapped differently in Start vs Stop (Start skip completes task, Stop follow-up retries)

## Changelog

- Implement outcome-based flow control for hook execution
