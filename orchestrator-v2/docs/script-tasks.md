# Script Task Execution Primitive

> GitHub issue: [#32 — Script task execution primitive](https://github.com/devzeebo/bifrost/issues/32)

## Problem

v1 couples every execution to a fixed Start → LLM → Stop lifecycle with mandatory hooks. v2 removes that coupling. The first building block is a standalone **run a script, get a result** unit that has no knowledge of engines, transport, or hooks.

## Solution

The `@bifrost-ai/interfaces-task` package defines a single task type: **Script**. There is no discriminated union of task kinds. An LLM task is not a first-class type — it is implemented as a Task Agent package that wraps a script (see [#37](https://github.com/devzeebo/bifrost/issues/37)).

### Types

```typescript
type ScriptTaskDefinition = {
  name: string;
  run: (ctx: ScriptContext) => Promise<ScriptResult>;
};

type ScriptContext = {
  taskState: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

type ScriptResult = {
  outcome: "completed" | "failed" | "paused";
  message?: string;
  telemetry?: ExecutionStats;
};
```

### Behavior contract

| Scenario | Outcome |
|---|---|
| `run()` returns `{ outcome: "completed" }` | Task completes |
| `run()` returns `{ outcome: "failed" }` | Task fails |
| `run()` returns `{ outcome: "paused" }` | Task pauses (e.g. waiting for human input) |
| `run()` throws | Treated as `failed` |
| `ctx.setState(...)` called during run | State persisted for the task via the task source |

`taskState` is the script's working memory across invocations of the same task. `metadata` is read-only context set when the task was created (workflow inputs, rune references, etc.).

`telemetry` is optional execution statistics (duration, token counts, cost) for observability. Scripts that don't use an LLM can omit it.

### What this package does not contain

- No engine adapters
- No network or RPC
- No hook machinery
- No in-process executor (the runner package provides execution; this package is types only)

The `ScriptContext` surface is defined here. Its RPC-backed implementation (calling `taskSource.setState` over the wire) lives in the runner.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Discriminated union `script \| llm` | LLM is an agent package atop the interface, not a task type |
| Keep v1 hooks | Hooks removed entirely from v2 |

## Dependencies

None. This is the foundation for every other v2 story.

## Verification

Acceptance criteria from the issue:

- A script can be defined and executed in-process (by the runner, once built)
- Returns `{ outcome, message?, telemetry? }`; `taskState` mutations persist; thrown errors yield `failed`
- No engine, transport, or hook code involved
