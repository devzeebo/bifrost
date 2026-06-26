# 20250624-003. Hook System for Lifecycle Extension

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Agents need to execute logic before/after LLM execution. Examples: baseline data collection, validation, file watching, test execution. Framework must support arbitrary user-defined logic without modifying core orchestration.

## Decision

Hook system with two lifecycle phases: `Start` (pre-engine) and `Stop` (post-engine). Hooks registered on agent definition, executed sequentially. Hooks receive execution context (task state, project dir, instructions) and return outcomes.

```typescript
export type Hooks = {
  Start: HookSpec[]; // Before engine execution
  Stop: HookSpec[]; // After engine execution
};

export type AgentDefinition = {
  name: string;
  description: string;
  tools: AgentTool[];
  template: Template;
  promptBody: string;
  hooks: Hooks; // Lifecycle hooks
};

// Hook registration
agent.hooks.Start.push({ name: "collectTests", fn: startHook_collectTests });
agent.hooks.Stop.push({ name: "checkTests", fn: stopHook_checkTests });
```

**Evolution (from git history):**

- Initial: HookExecutionContext had direct `taskState` field
- Later: Changed to `getTaskState()`/`setTaskState()` functions for better encapsulation

## Consequences

**Positive:**

- Agents inject custom logic without framework changes
- Hooks modify context (instructions, task state)
- Sequential execution ensures predictable order
- Hooks can abort execution (fatal outcome)
- State management via getTaskState/setTaskState
- Extensible (add new lifecycle phases later)

**Negative:**

- Sequential execution blocks on slow hooks
- Hook order matters (registration order = execution order)
- No parallel hook execution

## Changelog

- Define hook system with Start/Stop lifecycle phases for agent extensibility
