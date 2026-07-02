# Runner

> GitHub issue: [#36 — Runner package](https://github.com/devzeebo/bifrost/issues/36)

## Problem

v1 executes tasks inside the orchestrator process. v2 moves execution onto standalone **runners** that connect over the signed WebSocket protocol ([#33](protocol.md)). Each runner must dial in, authenticate, execute scripts locally, and report signed outcomes back to the orchestrator.

## Solution

The `@bifrost-ai/runner` package provides a config-first `Runner` class:

- Dials the orchestrator on `start()`, sends periodic heartbeats
- Validates every inbound orchestrator frame against the configured orchestrator public key
- Executes registered scripts locally with an RPC-backed `ScriptContext`
- Reports terminal outcomes (`task.complete`, `task.fail`, `task.pause`) over signed RPC

### Developer workflow

Scripts are enrolled incrementally so plugins can contribute without upfront declaration:

```typescript
import { Runner } from "@bifrost-ai/runner";
import { echo } from "./scripts/echo.js";
import { enrollTaskAgent } from "@bifrost-ai/agent-3-task";

const runner = new Runner();

runner.registerScript(echo);
enrollTaskAgent(runner); // plugin calls runner.registerScript()

await runner.start();
```

When `runner.yaml` (or `.bifrost-runner.yaml`) is present, keys and orchestrator URL are loaded automatically inside `start()` — no manual key handling required.

### Config file (`runner.yaml`)

```yaml
orchestrator:
  url: ws://127.0.0.1:9100
  keyId: orchestrator
  publicKeyPem: |
    -----BEGIN PUBLIC KEY-----
    ...
  # publicKeyPath: ./keys/orchestrator.pub.pem

identity:
  keyId: runner-1
  privateKeyPem: |
    -----BEGIN PRIVATE KEY-----
    ...
  publicKeyPem: |
    -----BEGIN PUBLIC KEY-----
    ...
  # privateKeyPath: ./keys/runner.pem
  # publicKeyPath: ./keys/runner.pub.pem

heartbeatIntervalMs: 10000
```

Config discovery order inside `start()`:

1. `configPath` constructor option
2. `RUNNER_CONFIG` environment variable
3. `runner.yaml` in `process.cwd()`
4. `.bifrost-runner.yaml` in `process.cwd()`

Explicit constructor options override config file values.

### Orchestrator pubkey validation

The runner trusts **only** the configured orchestrator public key for inbound frames:

1. Config loader builds `trustedPublicKeys` from `orchestrator.keyId` + PEM
2. `createRunnerPeer` passes that map to the protocol connection layer
3. `verifyEnvelope` runs on every inbound frame before subscribers receive payloads
4. Tampered, unsigned, or wrong-key frames are silently dropped

Outbound runner frames are signed with the runner identity key; the orchestrator validates against its `authorizedRunners` list.

### Dispatch lifecycle

```mermaid
sequenceDiagram
  participant O as Orchestrator
  participant R as Runner
  participant S as Script

  O->>R: dispatch Task signed
  R->>R: verify orchestrator signature
  alt unknown script
    R->>O: accepted false
  else known script
    R->>O: accepted true
    R->>S: script.run ctx
    S->>O: taskSource.setState RPC
    S-->>R: ScriptResult
    R->>O: task.complete / fail / pause
  end
```

### RPC-backed ScriptContext

| `ScriptContext` field | Source                                                       |
| --------------------- | ------------------------------------------------------------ |
| `taskState`           | Copied from dispatched `Task`; updated locally on `setState` |
| `metadata`            | Read-only from dispatched `Task`                             |
| `setState(state)`     | RPC `taskSource.setState` to orchestrator                    |

Task source and scheduler are reached over RPC. The engine (when used by agent packages) runs locally on the runner — never proxied.

## Alternatives rejected

| Alternative                      | Why rejected                                                        |
| -------------------------------- | ------------------------------------------------------------------- |
| In-process direct-call transport | One interface only — always WebSocket                               |
| Engine proxied to orchestrator   | Engine executes on runner machine                                   |
| Scripts declared in constructor  | Plugins need incremental `registerScript()` enrollment              |
| `Runner.create()` static factory | `new Runner()` + `registerScript()` + `start()` lifecycle preferred |

## Dependencies

- `@bifrost-ai/interfaces-task` — script types ([#32](script-tasks.md))
- `@bifrost-ai/protocol` — signed WebSocket transport ([#33](protocol.md))
- `@bifrost-ai/orchestrator` — dispatch target ([#35](orchestrator.md))

## Verification

Acceptance criteria from the issue:

- Runner dials in, authenticates, stays alive via heartbeat
- Dispatched task executes locally; `setState` round-trips; signed terminal result returned
- Engine runs locally (no engine RPC path)
- Config file drives keys/URL; orchestrator payloads validated against configured pubkey

See `packages/runner/src/runner.spec.ts` and `packages/runner/src/config-loader.spec.ts`.
