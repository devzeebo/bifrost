# Work item execution primitive

> GitHub issue: [#32 — Script task execution primitive](https://github.com/devzeebo/bifrost/issues/32)

## Problem

v1 couples every execution to a fixed Start → LLM → Stop lifecycle with mandatory hooks. v2 removes that coupling. The first building block is a standalone **run a handler, get a result** unit that has no knowledge of engines, transport, or hooks.

## Solution

The `@bifrost-ai/interfaces-work` package defines the work item model: a **work item instance** dispatched from a source, and a **work item handler** registered on the runner. There is no discriminated union of handler kinds. An LLM task agent is not a first-class type — it is implemented as a handler with `kind: "task"` (see [#37](https://github.com/devzeebo/bifrost/issues/37)).

### Types

```typescript
type WorkItem = {
  workItemId: string;
  kind: string;
  name: string;
  state: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
};

type WorkItemHandler = {
  kind: string;
  name: string;
  run: (workItem: WorkItem, ctx: WorkItemExecutionContext) => Promise<WorkItemResult>;
};

type WorkItemExecutionContext = {
  readonly data: DataRegistry;
  readonly handlers: WorkItemHandlerRegistry;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

type WorkItemResult = {
  outcome: "completed" | "failed" | "paused";
  message?: string;
  telemetry?: ExecutionStats;
};
```

### Behavior contract

| Scenario                                   | Outcome                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `run()` returns `{ outcome: "completed" }` | Work item completes                             |
| `run()` returns `{ outcome: "failed" }`    | Work item fails                                 |
| `run()` returns `{ outcome: "paused" }`    | Work item pauses (e.g. waiting for human input) |
| `run()` throws                             | Treated as `failed`                             |
| `ctx.setState(...)` called during run      | State persisted via the work item source        |

`workItem.state` is the handler's working memory across invocations of the same work item. `workItem.metadata` is read-only context set when the work item was created (workflow inputs, rune references, etc.).

`telemetry` is optional execution statistics (duration, token counts, cost) for observability. Handlers that don't use an LLM can omit it.

### What this package does not contain

- No engine adapters
- No network or RPC
- No hook machinery
- No in-process executor (the runner package provides execution; this package is types only)

The `WorkItemExecutionContext` surface is defined here. Its RPC-backed implementation (calling `workItemSource.setState` over the wire) lives in the runner.

## Alternatives rejected

| Alternative                         | Why rejected                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| Discriminated union `script \| llm` | LLM is a task agent handler atop the interface, not a type |
| Keep v1 hooks                       | Hooks removed entirely from v2                             |

## Dependencies

None. This is the foundation for every other v2 story.

## Verification

Acceptance criteria from the issue:

- A handler can be defined and executed in-process (by the runner, once built)
- Returns `{ outcome, message?, telemetry? }`; `state` mutations persist; thrown errors yield `failed`
- No engine, transport, or hook code involved
