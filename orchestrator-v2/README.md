# Orchestrator v2

A rebuild of the Bifrost orchestrator as a thin **get-work + dispatch** system. Execution happens on remote runners over a signed WebSocket RPC protocol. This monorepo contains the shared contracts and libraries that wire orchestrator, runners, and task sources together.

## Packages

| Package                              | Purpose                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| `@bifrost-ai/interfaces-task`        | Script task definition and result types                               |
| `@bifrost-ai/interfaces-task-source` | Task and `TaskSource` contracts                                       |
| `@bifrost-ai/protocol`               | Signed WebSocket RPC between orchestrator and runners                 |
| `@bifrost-ai/orchestrator`           | Thin orchestrator: stream tasks, dispatch to runners, record outcomes |
| `@bifrost-ai/runner`                 | Remote script runner: config-driven dial, execute, report outcomes    |
| `@bifrost-ai/engine`                 | Engine interface, types, and `TestEngine` for development/testing     |
| `@bifrost-ai/agent-3-task`           | Task Agent — single-shot LLM execution as a script                    |

For design background and how each piece fits together, see [docs/](docs/).

## Prerequisites

- Node.js >= 22.18
- [Vite+](https://viteplus.dev/) (`vp`)

```bash
vp install
```

## Development

```bash
vp run ready    # format, lint, typecheck, test, and build all packages
vp run -r test  # run tests
vp run -r build # build all packages
```

## Usage

### Define a script task

Scripts are plain async functions. There is no built-in LLM task type — higher-level agents (Task Agent, Workflow Agent) build on this interface.

```typescript
import type { ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";

const echo: ScriptTaskDefinition = {
  name: "echo",
  async run(ctx) {
    const message = ctx.metadata.message as string;
    await ctx.setState({ echoed: message });
    return { outcome: "completed", message };
  },
};
```

A script receives:

- `taskId`, `agentType`, `agentName` — from the dispatched task
- `taskState` — mutable per-task state (persisted via the task source)
- `metadata` — read-only context attached when the task was created
- `setState(state)` — persist state updates back to the source

It returns `{ outcome: "completed" | "failed" | "paused", message?, telemetry? }`. A thrown error is treated as `failed`.

### Implement a task source

The orchestrator does not resolve dependencies or inspect task graphs. Your `TaskSource` implementation owns that logic and yields **already-resolved** tasks.

```typescript
import type { Task, TaskSource } from "@bifrost-ai/interfaces-task-source";

const taskSource: TaskSource = {
  async *watchTasks() {
    yield {
      taskId: "task-1",
      agentType: "script",
      agentName: "echo",
      taskState: {},
      metadata: { message: "hello" },
    } satisfies Task;
  },
  async completeTask(taskId) {
    /* mark done */
  },
  async failTask(taskId, error) {
    /* mark failed */
  },
  async pauseTask(taskId) {
    /* mark paused */
  },
  async setState(taskId, taskState) {
    /* persist state */
  },
};
```

### Generate keys and run the orchestrator

Runners and the orchestrator authenticate with pre-shared ed25519 keys. Adding a runner requires updating config and restarting the orchestrator.

```typescript
import { runOrchestrator, loadAuthorizedRunners } from "@bifrost-ai/orchestrator";
import { exportPublicKeyPem, generateKeyPair } from "@bifrost-ai/protocol";

const orchestratorIdentity = generateKeyPair("orchestrator");
const runnerIdentity = generateKeyPair("runner-1");

const handle = await runOrchestrator({
  identity: orchestratorIdentity,
  authorizedRunners: loadAuthorizedRunners([
    { keyId: runnerIdentity.keyId, publicKeyPem: exportPublicKeyPem(runnerIdentity.publicKey) },
  ]),
  taskSource,
  scheduler: {
    async call(method, params) {
      // workflow scheduling callbacks from runners
      return { ok: true };
    },
  },
  port: 9100,
});

// handle.peer.address — WebSocket listen address
// handle.done — resolves when watchTasks() ends and in-flight work drains
```

### Run a runner

Runners dial the orchestrator over WebSocket. With `runner.yaml` present, keys and URL load automatically — register scripts and start:

```typescript
import { Runner } from "@bifrost-ai/runner";
import { createTaskAgent } from "@bifrost-ai/agent-3-task";

const runner = new Runner();

runner.registerAgent("script", echo);
runner.registerAgent("task", createTaskAgent({ engine, agent: reviewerAgent }));

await runner.start();
```

Example `runner.yaml`:

```yaml
orchestrator:
  url: ws://127.0.0.1:9100
  keyId: orchestrator
  publicKeyPem: |
    -----BEGIN PUBLIC KEY-----
    ...
identity:
  keyId: runner-1
  privateKeyPem: |
    -----BEGIN PRIVATE KEY-----
    ...
  publicKeyPem: |
    -----BEGIN PUBLIC KEY-----
    ...
```

See [docs/runner.md](docs/runner.md) for config discovery, trust model, and plugin enrollment.

### RPC methods exposed by the orchestrator

Runners call back into the orchestrator over the same signed WebSocket:

| Method                | Params                  | Description            |
| --------------------- | ----------------------- | ---------------------- |
| `task.complete`       | `{ taskId }`            | Mark task completed    |
| `task.fail`           | `{ taskId, message? }`  | Mark task failed       |
| `task.pause`          | `{ taskId }`            | Mark task paused       |
| `taskSource.setState` | `{ taskId, taskState }` | Persist script state   |
| `scheduler.call`      | `{ method, args }`      | Invoke scheduler proxy |

The orchestrator dispatches work with `dispatch` RPC requests containing a full `Task` object.

## Documentation

- [docs/](docs/) — how the system works (architecture, design decisions)
- [packages/protocol/README.md](packages/protocol/README.md) — protocol implementation details
- [packages/interfaces-task-source/README.md](packages/interfaces-task-source/README.md) — task source contract details

## Related issues

This work tracks the Orchestrator v2 rebuild:

- [#32 Script task execution primitive](https://github.com/devzeebo/bifrost/issues/32)
- [#33 Runner↔orchestrator protocol](https://github.com/devzeebo/bifrost/issues/33)
- [#35 Thin orchestrator](https://github.com/devzeebo/bifrost/issues/35)
- [#36 Runner package](https://github.com/devzeebo/bifrost/issues/36)
- [#37 Task Agent (`agent-3-task`)](https://github.com/devzeebo/bifrost/issues/37) — [lifecycle docs](docs/agent-3-task.md)
- [#39 Workflow Agent (`agent-4-workflow`)](https://github.com/devzeebo/bifrost/issues/39) — [lifecycle docs](docs/agent-4-workflow.md)
- [#41 Structured output package](https://github.com/devzeebo/bifrost/issues/41) — schemas, sentinel files, JSON/YAML validation
