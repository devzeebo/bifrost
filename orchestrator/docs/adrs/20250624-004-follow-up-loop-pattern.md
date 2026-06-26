# 20250624-004. Follow-Up Loop Pattern

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agents may need multiple attempts to complete tasks. Example: BDD Red agent writes test, BDD Green agent makes it pass, but test may still be flaky or incomplete. Framework must support iterative refinement without manual intervention.

## Decision

Stop hooks can return `outcome: "follow-up"` with message. Orchestrator re-executes engine with follow-up message as additional instructions. Loop continues until all hooks return success or max attempts (10) reached.

```typescript
export type HookResult = {
  outcome: "success" | "follow-up" | "fatal" | "skip" | "pause";
  message?: string;
};

// Stop hook triggering follow-up
if (!hasNewFailingTests) {
  return {
    outcome: "follow-up",
    message: "No new failing tests found. Add at least one failing test.",
  };
}

// Orchestrator loop
while (attemptsUsed <= maxFollowUps) {
  const engineResult = await engine.execute(engineContext, sessionId);

  const stopHookResults = await executeHooks({
    hooks: agent.hooks.Stop,
    lifecycle: "Stop",
    context: hookContext,
  });

  const needsFollowUp = stopHookResults.some((h) => h.outcome === "follow-up");
  if (!needsFollowUp) break;

  followUpInstructions = stopHookResults.find((h) => h.outcome === "follow-up")?.message;
}
```

## Consequences

**Positive:**

- Automatic iterative refinement
- Hooks provide specific feedback for next attempt
- Session continuity (sessionId passed to engine)
- Bounded loop prevents infinite loops
- Telemetry aggregated across all attempts

**Negative:**

- Max attempts hardcoded (10)
- No exponential backoff between attempts
- Later follow-up messages overwrite earlier ones
- Hooks can't distinguish first attempt from retry

## Changelog

- Implement follow-up loop pattern for iterative agent refinement
