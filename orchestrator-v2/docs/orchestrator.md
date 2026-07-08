# Thin Orchestrator

> GitHub issue: [#35 — Thin orchestrator](https://github.com/devzeebo/bifrost/issues/35)

## Problem

v1's `Orchestrator.run()` pulls a task and immediately executes it in-process with hooks. v2 splits that: the orchestrator only pulls already-resolved tasks and pushes them to connected runners.

## Solution

The `@bifrost-ai/orchestrator` package implements a **get-work + dispatch** loop with no execution logic.

### What the orchestrator does

1. Starts a WebSocket server (via `protocol`).
2. Accepts runner connections authenticated by pre-shared ed25519 keys.
3. Streams work items from `workItemSource.watchWorkItems()`.
4. Dispatches each work item to an available, heartbeating runner.
5. Routes runner RPC callbacks to the task source and scheduler.
6. Drains in-flight work when the task stream ends.

### What the orchestrator does not do

- Dependency inspection or resolution (the task source owns this)
- Hook execution or BeforeDispatch guards
- Engine selection or prompt rendering
- Script execution
- Dynamic runner registration

### Core loop

```mermaid
sequenceDiagram
  participant TS as WorkItemSource
  participant O as Orchestrator
  participant R as Runner

  R->>O: heartbeat { runnerId }
  TS-->>O: watchWorkItems() yields WorkItem
  O->>O: waitForAvailablePeer()
  O->>R: rpc.request dispatch(WorkItem)
  R->>O: rpc.response { accepted: true }
  Note over R: execute handler
  R->>O: rpc.request workItem.complete { workItemId }
  O->>TS: completeWorkItem(workItemId)
  O->>R: rpc.response { ok: true }
```

### Components

| Module               | Responsibility                                                  |
| -------------------- | --------------------------------------------------------------- |
| `Orchestrator`       | Main loop: watch tasks, apply mappers, dispatch, drain, cleanup |
| `PeerRegistry`       | Track connected peers, heartbeats, in-flight counts             |
| `DispatchTracker`    | Map dispatch IDs and task IDs to in-flight entries              |
| `dispatcher`         | Send `dispatch` RPC to a peer                                   |
| `DispatchAckHandler` | Handle dispatch accept/reject responses                         |
| `ResultHandler`      | Handle `workItem.complete` / `workItem.fail` / `workItem.pause` |
| `RpcRouter`          | Route runner RPC to task source and scheduler                   |
| `config`             | Load authorized runner public keys from PEM entries             |

### Runner availability

A peer is available for dispatch when:

1. It has sent at least one `heartbeat` with a `runnerId`.
2. Its last heartbeat is within `heartbeatTimeoutMs` (default 30s).
3. Its in-flight count is below `maxInFlightPerPeer` (default 1).

The dispatch loop blocks on `waitForAvailablePeer()` until a runner meets all three conditions.

### Dispatch lifecycle

1. Orchestrator generates a `dispatchId` and sends `rpc.request { method: "dispatch", params: WorkItem }`.
2. Runner responds with `rpc.response { result: { accepted: true } }` or `{ accepted: false, reason }`.
3. If rejected, orchestrator calls `workItemSource.failWorkItem` and frees the peer slot.
4. If accepted, the work item is in-flight until the runner sends a terminal RPC (`workItem.complete`, `workItem.fail`, or `workItem.pause`).
5. On peer disconnect, all in-flight work items for that peer are failed with `"Runner disconnected"`.

### Configuration

Registration happens on the `Orchestrator` instance before `start()`. Runtime options are passed to `start()` and do not include `workItemSource`.

```typescript
import { Orchestrator, loadAuthorizedRunners } from "@bifrost-ai/orchestrator";

const orchestrator = new Orchestrator();
orchestrator.registerWorkItemSource(workItemSource);
orchestrator.addWorkItemMapper("task", (workItem) => workItem);

type OrchestratorStartOptions = {
  identity: PeerIdentity;
  authorizedRunners: ReadonlyMap<string, KeyObject>;
  scheduler: Scheduler;
  host?: string;
  port?: number;
  heartbeatTimeoutMs?: number; // default 30000
  maxInFlightPerPeer?: number; // default 1
  abortSignal?: AbortSignal;
};

const handle = await orchestrator.start({
  identity: orchestratorIdentity,
  authorizedRunners: loadAuthorizedRunners([{ keyId, publicKeyPem }]),
  scheduler,
  port: 9100,
});
```

Authorized runners are loaded via `loadAuthorizedRunners([{ keyId, publicKeyPem }])`. Adding a runner requires updating this list and restarting.

### Scheduler proxy

Runners can call `scheduler.call(method, args)` through the orchestrator. This is a generic RPC proxy for workflow scheduling (retries, DAG advancement, etc.) without the orchestrator implementing scheduling logic itself. The `Scheduler` interface is:

```typescript
type Scheduler = {
  call(method: string, params: unknown): Promise<unknown>;
};
```

## Alternatives rejected

| Alternative                                 | Why rejected                     |
| ------------------------------------------- | -------------------------------- |
| Orchestrator inspects/resolves dependencies | Task source owns resolution      |
| Dynamic runner registration                 | Static pre-shared keys + restart |
| Hooks / BeforeDispatch guards               | Removed entirely from v2         |

## Dependencies

- `@bifrost-ai/protocol` — WebSocket server and signed frames ([#33](protocol.md))
- `@bifrost-ai/interfaces-work` — work item streaming and outcome recording
- Exercised end-to-end with the runner package ([#36](https://github.com/devzeebo/bifrost/issues/36))

## Verification

Acceptance criteria from the issue:

- Work items stream from the source, are dispatched to connected runners, and complete
- Failing handler → `failWorkItem`; paused handler → `pauseWorkItem`
- Authorized runner keys from config; unknown key rejected (frames silently dropped at protocol layer)
- No dependency-resolution, hook, engine, or prompt-rendering logic in the orchestrator

See `packages/orchestrator/src/orchestrator.spec.ts` for vitest-gwt integration tests with a stub runner.
