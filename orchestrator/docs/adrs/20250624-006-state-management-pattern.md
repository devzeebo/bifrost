# 20250624-006. State Management Pattern

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Hooks need to share data across lifecycle phases. Example: Start hook collects baseline data, Stop hook validates against it. Framework needs cross-hook data passing without global state.

## Decision

Mutable task state pattern. Hooks receive `getTaskState()` and `setTaskState()` functions. State persisted to TaskSource via `setState()`. Each engine execution receives current state.

```typescript
export type HookExecutionContext = {
  getTaskState: () => Record<string, unknown>;
  setTaskState: (newState: Record<string, unknown>) => Promise<void>;
  // ...
};

// Start hook stores data
await setTaskState({ baselineData: [1, 2, 3] });

// Stop hook retrieves data
const state = getTaskState();
const baseline = state.baselineData ?? [];
```

**Evolution (from git history):**

- Initial: HookExecutionContext had direct `taskState` field
- Changed: `getTaskState()`/`setTaskState()` for better encapsulation

## Consequences

**Positive:**

- Cross-hook data sharing
- State persisted to TaskSource (survives failures)
- Encapsulated access (no direct mutation)
- Engine receives latest state each execution

**Negative:**

- No transaction/rollback support
- Concurrent state updates can race
- State structure implicit (no schema enforcement)
- Memory overhead for large state

## Changelog

- Implement mutable task state pattern for cross-hook data sharing
