# 20250624-008. Telemetry Aggregation Strategy

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Follow-up loops execute engine multiple times. Framework needs to aggregate telemetry (tokens, cost, duration) across all attempts for accurate reporting. Individual attempt stats insufficient.

## Decision

Accumulate EngineResult.stats across loop iterations. `totalTelemetry` object tracks sums. Final telemetry includes aggregated stats plus total duration/turns.

```typescript
let totalTelemetry: EngineResult["stats"] = null;
let numTurns = 0;

while (attemptsUsed <= maxFollowUps) {
  const engineResult = await engine.execute(engineContext, sessionId);

  if (engineResult.stats) {
    if (!totalTelemetry) {
      totalTelemetry = { ...engineResult.stats };
    } else {
      // Accumulate
      totalTelemetry.durationMs += engineResult.stats.durationMs;
      totalTelemetry.inputTokens += engineResult.stats.inputTokens;
      totalTelemetry.outputTokens += engineResult.stats.outputTokens;
      totalTelemetry.cacheReadTokens += engineResult.stats.cacheReadTokens;
      totalTelemetry.cacheCreationTokens += engineResult.stats.cacheCreationTokens;
      totalTelemetry.totalCostUsd += engineResult.stats.totalCostUsd;
      totalTelemetry.numTurns += engineResult.stats.numTurns;
    }
  }

  numTurns += 1;
}

// Final return
return {
  outcome: "completed",
  telemetry: totalTelemetry ? { ...totalTelemetry, durationMs, numTurns } : { ... }
};
```

## Consequences

**Positive:**

- Accurate total cost tracking
- Turn count reflects actual iterations
- Duration captured separately (not from engine)
- Null-safe (handles missing stats)

**Negative:**

- Manual field-by-field accumulation
- Engine stats structure changes require updates
- No per-attempt breakdown in final result

## Changelog

- Implement telemetry aggregation across follow-up loop iterations
