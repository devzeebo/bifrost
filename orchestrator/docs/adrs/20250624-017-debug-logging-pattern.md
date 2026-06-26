# 20250624-017. Debug Logging Pattern

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Framework needs configurable debug output for troubleshooting. Production runs should minimize logging overhead. Development requires detailed execution traces. Multiple packages need consistent logging behavior with granular control.

## Decision

Use `debug` package with hierarchical namespaces. Core packages use `bifrost`. Implementations use scoped namespaces like `bifrost:engine:claude-code`. Environment variable `DEBUG=bifrost:*` enables all, `DEBUG=bifrost:engine:*` enables engine layer only. Structured messages with context.

```typescript
import createDebug from "debug";

// Core orchestrator
const debug = createDebug("bifrost");

// Engine implementation
const debug = createDebug("bifrost:engine:claude-code");

// Task source implementation
const debug = createDebug("bifrost:task-source:bifrost");

// Hook execution
debug("Start hook %s start", hook.name);
debug("Start hook %s → %s", hook.name, result.outcome);

// Engine execution
debug("engine execute attempt %d/%d task=%s", attemptsUsed, maxFollowUps, task.id);

// Sampling for high-frequency logs
const SAMPLE_RATE = 100;
if (pollCount % SAMPLE_RATE === 0) {
  debug("Poll #%d (interval: %dms)", pollCount, Math.round(pollInterval));
}
```

**Hierarchical namespaces:**

- `DEBUG=bifrost` - Core orchestrator only
- `DEBUG=bifrost:engine:*` - All engine implementations
- `DEBUG=bifrost:engine:claude-code` - Claude Code engine only
- `DEBUG=bifrost:*` - All bifrost packages

## Consequences

**Positive:**

- Zero-cost logging in production (no DEBUG set)
- Hierarchical namespaces for granular control
- Printf-style formatting (faster than template strings)
- Group related packages (e.g., all engines)
- Environment-based control

**Negative:**

- No structured logging (JSON)
- No log levels (only on/off)
- Requires namespace convention compliance

## Changelog

- Implement debug logging pattern with hierarchical namespaces for granular control
