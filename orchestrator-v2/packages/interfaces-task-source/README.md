# @bifrost-ai/interfaces-task-source

Task and `TaskSource` contracts for orchestrator v2.

This package defines the boundary between the orchestrator and whatever system produces work. The orchestrator streams tasks from a `TaskSource` and reports outcomes back — it never inspects task graphs, resolves dependencies, or understands workflow structure.

Design background: used by [docs/orchestrator.md](../../docs/orchestrator.md) · Issue [#35](https://github.com/devzeebo/bifrost/issues/35)

## Purpose

In v1, the orchestrator owned dependency resolution and task lifecycle. In v2, that responsibility moves to the task source implementation. The orchestrator is a thin dispatch layer that:

1. Calls `watchTasks()` and dispatches each yielded task to a runner.
2. Calls `completeTask`, `failTask`, or `pauseTask` when the runner reports an outcome.
3. Proxies `setState` calls from runners back to the source.

This package defines only the TypeScript interfaces — no implementation. Concrete sources (in-memory for tests, Bifrost adapter ([#40](https://github.com/devzeebo/bifrost/issues/40)), workflow engine ([#39](https://github.com/devzeebo/bifrost/issues/39))) live in separate packages.

## Types

### Task

A task ready for dispatch. The orchestrator does not resolve or enrich it — everything the runner needs is already present.

```typescript
type Task = {
  id: string;
  scriptName: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
};
```

| Field | Description |
|---|---|
| `id` | Unique task identifier within the source |
| `scriptName` | Name of the script to execute (runner resolves this to a `ScriptTaskDefinition`) |
| `taskState` | Mutable state persisted across script invocations |
| `metadata` | Read-only context (workflow inputs, rune refs, etc.) |

The orchestrator sends the full `Task` object as the `params` of a `dispatch` RPC frame. The runner uses `scriptName` to look up the script and passes `taskState` / `metadata` into `ScriptContext`.

### TaskSource

```typescript
type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>;
  completeTask: (taskId: string) => Promise<void>;
  failTask: (taskId: string, error: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  setState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>;
};
```

#### `watchTasks()`

Yields tasks that are **already dependency-resolved** and ready to run. The orchestrator iterates this generator in a simple `for await` loop:

```typescript
for await (const task of taskSource.watchTasks()) {
  const runner = await registry.waitForAvailablePeer();
  dispatchTask(runner, task, tracker, registry);
}
```

The source decides:

- Which tasks are ready (dependencies fulfilled, draft vs live mode, etc.)
- Ordering and pacing of yields
- When the stream ends

The orchestrator does not call back into the source to ask "what's next?" beyond consuming the generator.

#### `completeTask(taskId)`

Called when a runner sends `task.complete`. The source should mark the task as done and unblock any dependent tasks.

#### `failTask(taskId, error)`

Called when:

- A runner sends `task.fail`
- A runner rejects a dispatch (`{ accepted: false }`)
- A runner disconnects while a task is in-flight

The `error` string is the failure reason (runner message, disconnect notice, or rejection reason).

#### `pauseTask(taskId)`

Called when a runner sends `task.pause`. Used when a script returns `{ outcome: "paused" }` — e.g. waiting for human approval before continuing.

#### `setState(taskId, taskState)`

Called when a runner proxies a `taskSource.setState` RPC. Scripts call `ctx.setState(...)` during execution; the runner forwards this to the orchestrator, which calls this method. The source persists the updated state so it is available on the next invocation.

## Relationship to other packages

```
interfaces-task-source          interfaces-task
  Task { scriptName, ... }  →     ScriptTaskDefinition { name, run }
  taskState, metadata       →     ScriptContext { taskState, metadata, setState }
```

| Package | Role |
|---|---|
| `interfaces-task-source` | What work exists and its lifecycle |
| `interfaces-task` | How a single script executes |
| `orchestrator` | Streams tasks, dispatches, records outcomes |
| `protocol` | Wire transport for dispatch and callbacks |

## Orchestrator RPC mapping

The orchestrator proxies runner RPC calls to `TaskSource` methods:

| Runner RPC method | TaskSource method |
|---|---|
| `task.complete` | `completeTask(taskId)` |
| `task.fail` | `failTask(taskId, message)` |
| `task.pause` | `pauseTask(taskId)` |
| `taskSource.setState` | `setState(taskId, taskState)` |

The orchestrator validates that the task is in-flight on the calling peer before forwarding terminal outcomes.

## Implementation guidance

### Dependency resolution belongs here

If task B depends on task A, the source should only yield B after A is completed. The orchestrator has no visibility into dependencies.

### Draft vs live

The source can implement draft/live modes ([#34](https://github.com/devzeebo/bifrost/issues/34)) by filtering which tasks appear in `watchTasks()`. The orchestrator is unaware of this distinction.

### Generator lifecycle

`watchTasks()` should be a long-lived or finite async generator. When it completes, the orchestrator drains in-flight dispatches and shuts down. A source that needs to run indefinitely can yield tasks as they become ready and never return from the generator until explicitly stopped.

### Test implementations

The orchestrator test suite includes `createMemoryTaskSource` in `test-helpers.ts` — a simple in-memory implementation that yields a fixed task list and records outcomes in arrays. Use this as a reference for implementing the interface.

## What this package does not contain

- No Bifrost/bf integration (see [#40](https://github.com/devzeebo/bifrost/issues/40))
- No dependency graph logic
- No draft/live mode implementation
- No persistence layer
- No network or RPC code

This is a pure interface package — types only, no runtime logic.
