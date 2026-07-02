# @bifrost-ai/runner

Remote script runner for Bifrost orchestrator v2.

Design background: [docs/runner.md](../../docs/runner.md) · Issue [#36](https://github.com/devzeebo/bifrost/issues/36)

## Purpose

Runners dial the orchestrator, execute registered scripts locally, and report signed outcomes. This package is the primary entry point for building a runner process.

## Public API

### `Runner`

```typescript
const runner = new Runner(options?: RunnerOptions);

runner.registerScript(script: ScriptTaskDefinition): void;
await runner.start(): Promise<void>;
runner.close(): void;
runner.connection: RunnerPeer; // after start()
```

### Config-driven usage

With `runner.yaml` present, only scripts need to be registered:

```typescript
const runner = new Runner();
runner.registerScript(echo);
await runner.start();
```

### Programmatic overrides (tests / embedding)

```typescript
const runner = new Runner({
  identity: runnerIdentity,
  url: "ws://127.0.0.1:9100",
  orchestratorPublicKey: { keyId, publicKeyPem },
});
```

### Lower-level exports

- `loadRunnerConfig(configPath)` — parse and validate YAML config
- `resolveRunnerOptions(options)` — merge config file + overrides
- `executeScript(registry, name, ctx)` — run a script in-process
- `createRpcScriptContext(task, rpc)` — build RPC-backed `ScriptContext`
- `createRpcClient(peer)` — RPC helper for orchestrator callbacks
- `ScriptRegistry` — mutable script map

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

| Module                | Responsibility                                 |
| --------------------- | ---------------------------------------------- |
| `runner.ts`           | `Runner` class lifecycle                       |
| `config-loader.ts`    | YAML discovery, PEM loading, option resolution |
| `script-registry.ts`  | `registerScript` backing store                 |
| `dispatch-handler.ts` | Handle `dispatch` RPC → execute → terminal RPC |
| `script-context.ts`   | RPC-backed `ScriptContext`                     |
| `rpc-client.ts`       | Signed RPC request/response helper             |
| `execute-script.ts`   | In-process script execution                    |
| `heartbeat.ts`        | Periodic signed heartbeats                     |

## Error cases

- `Runner already started` — second `start()` call
- `Runner not started` — accessing `connection` before `start()`
- `Script already registered: {name}` — duplicate `registerScript`
- Config validation errors — missing url, keys, or invalid PEM paths (fail before dial)

## Trust model

Inbound: only frames signed by `orchestrator.keyId` reach handlers (protocol layer).

Outbound: all runner frames signed with runner identity; orchestrator must list runner pubkey in `authorizedRunners`.
