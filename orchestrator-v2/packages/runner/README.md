# @bifrost-ai/runner

Remote script runner for Bifrost orchestrator v2.

Design background: [docs/runner.md](../../docs/runner.md) · Issue [#36](https://github.com/devzeebo/bifrost/issues/36)

## Purpose

Runners dial the orchestrator, execute registered agents locally, and report signed outcomes. This package is the primary entry point for building a runner process.

## Public API

### `Runner`

```typescript
const data = createDataRegistry({ engine: isEngine });
const runner = new Runner({ data });

data.get("engine").register("claude", claudeEngine);
runner.registerWorkItemHandler(echo);
await runner.start();
runner.close();
runner.connection: RunnerPeer; // after start()
runner.data: MutableDataRegistry<TData>;
```

### Config-driven usage

With `runner.yaml` present, register data and agents before starting:

```typescript
const runner = new Runner({ data });
runner.registerWorkItemHandler(echo);
await runner.start();
```

### Lower-level exports

- `createDataRegistry(guards)` — create a typed data registry up front
- `asDataRegistry(data)` — read-only view for script context
- `loadRunnerConfig(configPath)` — parse and validate YAML config
- `resolveRunnerOptions(options)` — merge config file + overrides
- `executeWorkItem(handler, ctx)` — run a handler in-process
- `createRpcWorkItemExecutionContext(workItem, rpc, data, handlers)` — build RPC-backed `WorkItemExecutionContext`
- `createRpcClient(peer)` — RPC helper for orchestrator callbacks
- `Registry` — generic name-keyed registry backing store

## Registry model

| Kind  | Setup                              | Dispatch                          | Handler access                 |
| ----- | ---------------------------------- | --------------------------------- | ------------------------------ |
| Data  | `createDataRegistry(guards)`       | Never                             | `ctx.data.get(type).get(name)` |
| Agent | `registerWorkItemHandler(handler)` | `workItem.kind` + `workItem.name` | `ctx.handlers.get(kind, name)` |

## Config schema

| Field                                          | Required | Description                      |
| ---------------------------------------------- | -------- | -------------------------------- |
| `orchestrator.url`                             | yes      | WebSocket URL (`ws://host:port`) |
| `orchestrator.keyId`                           | yes      | Orchestrator signing key id      |
| `orchestrator.publicKeyPem` or `publicKeyPath` | yes      | Trusted orchestrator public key  |
| `identity.keyId`                               | yes      | Runner signing key id            |
| `identity.privateKeyPem` or `privateKeyPath`   | yes      | Runner private key               |
| `identity.publicKeyPem` or `publicKeyPath`     | yes      | Runner public key                |
| `heartbeatIntervalMs`                          | no       | Default `10000`                  |

PEM paths resolve relative to the config file directory.

## Module map

| Module                           | Responsibility                                 |
| -------------------------------- | ---------------------------------------------- |
| `runner.ts`                      | `Runner` class lifecycle                       |
| `data-registry.ts`               | `createDataRegistry`, guarded sub-registries   |
| `config-loader.ts`               | YAML discovery, PEM loading, option resolution |
| `registry.ts`                    | Generic name-keyed registry                    |
| `dispatch-handler.ts`            | Handle `dispatch` RPC → execute → terminal RPC |
| `work-item-execution-context.ts` | RPC-backed `WorkItemExecutionContext`          |
| `rpc-client.ts`                  | Signed RPC request/response helper             |
| `execute-work-item.ts`           | In-process handler execution                   |
| `heartbeat.ts`                   | Periodic signed heartbeats                     |

## Error cases

- `Runner already started` — second `start()` call
- `Runner not started` — accessing `connection` before `start()`
- `Already registered: {name}` — duplicate registration in a registry
- `Invalid data registration: {name}` — item failed the type guard for that data type
- Config validation errors — missing url, keys, or invalid PEM paths (fail before dial)

## Trust model

Inbound: only frames signed by `orchestrator.keyId` reach handlers (protocol layer).

Outbound: all runner frames signed with runner identity; orchestrator must list runner pubkey in `authorizedRunners`.
