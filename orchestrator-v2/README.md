# Orchestrator v2

A rebuild of the Bifrost orchestrator as a thin **get-work + dispatch** system. Execution happens on remote runners over a signed WebSocket RPC protocol. This monorepo contains the shared contracts and libraries that wire orchestrator, runners, and work item sources together.

## Packages

| Package                          | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `@bifrost-ai/interfaces-work`    | Work item, handler, and execution contracts                          |
| `@bifrost-ai/protocol`           | Signed WebSocket RPC between orchestrator and runners                |
| `@bifrost-ai/orchestrator`       | Thin orchestrator: stream work items, dispatch, record outcomes      |
| `@bifrost-ai/runner`             | Remote runner: config-driven dial, execute handlers, report outcomes |
| `@bifrost-ai/engine`             | Engine interface, types, and `TestEngine` for development/testing    |
| `@bifrost-ai/engine-claude-code` | Claude Code Agent SDK engine (`ClaudeCodeEngine`)                    |
| `@bifrost-ai/engine-cursor`      | Cursor SDK engine (`CursorEngine`)                                   |
| `@bifrost-ai/agent-3-task`       | Task Agent — single-shot LLM execution (`kind: "task"`)              |

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

### Define a work item handler

Handlers are registered on the runner and executed when a matching work item is dispatched. Higher-level agents (Task Agent, Workflow Agent) build on this interface.

```typescript
import type { WorkItemHandler } from "@bifrost-ai/interfaces-work";

const echo: WorkItemHandler = {
  kind: "script",
  name: "echo",
  async run(workItem, ctx) {
    const message = workItem.metadata.message as string;
    await ctx.setState({ echoed: message });
    return { outcome: "completed", message };
  },
};
```

A handler receives:

- `workItem` — the dispatched instance (`workItemId`, `kind`, `name`, `state`, `metadata`)
- `ctx.data` — `get(type)` returns a typed `Registry<T>`, then `.get(name)` for the instance
- `ctx.handlers` — `get(kind, name)` for other registered handlers
- `ctx.setState(state)` — persist state updates back to the work item source

It returns `{ outcome: "completed" | "failed" | "paused", message?, telemetry? }`. A thrown error is treated as `failed`.

### Implement a work item source

The orchestrator does not resolve dependencies or inspect work graphs. Your `WorkItemSource` implementation owns that logic and yields **already-resolved** work items.

```typescript
import type { WorkItem, WorkItemSource } from "@bifrost-ai/interfaces-work";

const workItemSource: WorkItemSource = {
  async *watchWorkItems() {
    yield {
      workItemId: "work-item-1",
      kind: "script",
      name: "echo",
      state: {},
      metadata: { message: "hello" },
    } satisfies WorkItem;
  },
  async completeWorkItem(workItemId) {
    /* mark done */
  },
  async failWorkItem(workItemId, error) {
    /* mark failed */
  },
  async pauseWorkItem(workItemId) {
    /* mark paused */
  },
  async setState(workItemId, state) {
    /* persist state */
  },
};
```

### Generate keys and run the orchestrator

Runners and the orchestrator authenticate with pre-shared ed25519 keys. Adding a runner requires updating config and restarting the orchestrator.

```typescript
import { Orchestrator, loadAuthorizedRunners } from "@bifrost-ai/orchestrator";
import { exportPublicKeyPem, generateKeyPair } from "@bifrost-ai/protocol";

const orchestratorIdentity = generateKeyPair("orchestrator");
const runnerIdentity = generateKeyPair("runner-1");

const orchestrator = new Orchestrator();
orchestrator.registerWorkItemSource(workItemSource);

const handle = await orchestrator.start({
  identity: orchestratorIdentity,
  authorizedRunners: loadAuthorizedRunners([
    { keyId: runnerIdentity.keyId, publicKeyPem: exportPublicKeyPem(runnerIdentity.publicKey) },
  ]),
  scheduler: {
    async call(method, params) {
      // workflow scheduling callbacks from runners
      return { ok: true };
    },
  },
  port: 9100,
});

// handle.peer.address — WebSocket listen address
// handle.done — resolves when watchWorkItems() ends and in-flight work drains
```

### Run a runner

Runners dial the orchestrator over WebSocket. With `runner.yaml` present, keys and URL load automatically — register handlers and start:

```typescript
import { Runner, createDataRegistry } from "@bifrost-ai/runner";
import "@bifrost-ai/agent-3-task/augment";
import { loadAgent, taskAgentDataGuards } from "@bifrost-ai/agent-3-task";
import { ClaudeCodeEngine } from "@bifrost-ai/engine-claude-code";
import { CursorEngine } from "@bifrost-ai/engine-cursor";

const data = createDataRegistry(taskAgentDataGuards);
const runner = new Runner({ data });

runner.registerEngine("claude", new ClaudeCodeEngine());
runner.registerEngine("cursor", new CursorEngine());
runner.registerTaskAgent("reviewer", await loadAgent("./agents/reviewer/AGENT.md"));
runner.registerScriptAgent("echo", echo);

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

See [docs/runner.md](docs/runner.md) for config discovery, trust model, and handler enrollment.

### RPC methods exposed by the orchestrator

Runners call back into the orchestrator over the same signed WebSocket:

| Method                    | Params                     | Description              |
| ------------------------- | -------------------------- | ------------------------ |
| `workItem.complete`       | `{ workItemId }`           | Mark work item completed |
| `workItem.fail`           | `{ workItemId, message? }` | Mark work item failed    |
| `workItem.pause`          | `{ workItemId }`           | Mark work item paused    |
| `workItemSource.setState` | `{ workItemId, state }`    | Persist handler state    |
| `scheduler.call`          | `{ method, args }`         | Invoke scheduler proxy   |

The orchestrator dispatches work with `dispatch` RPC requests containing a full `WorkItem` object.

## Documentation

- [docs/](docs/) — how the system works (architecture, design decisions)
- [packages/protocol/README.md](packages/protocol/README.md) — protocol implementation details

## Related issues

This work tracks the Orchestrator v2 rebuild:

- [#32 Script task execution primitive](https://github.com/devzeebo/bifrost/issues/32)
- [#33 Runner↔orchestrator protocol](https://github.com/devzeebo/bifrost/issues/33)
- [#35 Thin orchestrator](https://github.com/devzeebo/bifrost/issues/35)
- [#36 Runner package](https://github.com/devzeebo/bifrost/issues/36)
- [#37 Task Agent (`agent-3-task`)](https://github.com/devzeebo/bifrost/issues/37) — [lifecycle docs](docs/agent-3-task.md)
- [#39 Workflow Agent (`agent-4-workflow`)](https://github.com/devzeebo/bifrost/issues/39) — [lifecycle docs](docs/agent-4-workflow.md)
- [#41 Structured output package](https://github.com/devzeebo/bifrost/issues/41) — schemas, sentinel files, JSON/YAML validation
