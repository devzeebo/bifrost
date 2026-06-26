# 20250624-001. Interface-Based Plugin Architecture

Date: 2025-06-24
Version: 1

## Status

Proposed

## Context

Framework needs to support multiple LLM engines (Claude Code, Devin CLI) and task sources (Bifrost API, in-memory) without coupling core orchestration logic to implementations. Git history shows engine and task-source packages emerged early, suggesting this was a foundational decision.

## Decision

Define core interfaces (`Engine` and `TaskSource`) that implementations must satisfy. Core orchestrator depends only on interfaces, not concrete implementations. Use dependency injection - orchestrator constructor receives Engine and TaskSource instances.

```typescript
// Engine interface - abstracts LLM execution
export type Engine = {
  execute: (context: EngineContext, sessionId?: string) => Promise<EngineResult>;
};

// TaskSource interface - abstracts task storage/retrieval
export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>;
  completeTask: (taskId: string) => Promise<void>;
  failTask: (taskId: string, error: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  setState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>;
};

// Dependency injection in Orchestrator constructor
export class Orchestrator {
  constructor(options: {
    taskSource: TaskSource; // Injected interface
    engine: Engine; // Injected interface
    projectDir?: string;
  }) {
    this.taskSource = options.taskSource;
    this.engine = options.engine;
    // ...
  }
}
```

## Consequences

**Positive:**

- Easy to add new engines/task sources (implement interface, inject into orchestrator)
- Core orchestration logic isolated from implementation details
- Testable with mock implementations
- Runtime behavior swappable via different implementations

**Negative:**

- Interface changes require updating all implementations
- Runtime validation relies on TypeScript compilation

## Changelog

- Define core Engine and TaskSource interfaces for plugin architecture
