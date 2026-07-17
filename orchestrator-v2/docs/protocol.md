# Runner ↔ Orchestrator Protocol

> GitHub issue: [#33 — Runner↔orchestrator protocol (signing + RPC)](https://github.com/devzeebo/bifrost/issues/33)

## Problem

v1 executes tasks in-process. v2 splits execution onto runners, so the orchestrator and runners need **one** uniform, authenticated communications channel. A runner on the same machine still talks to the orchestrator over the socket — there is no local direct-call shortcut.

## Solution

The `@bifrost-ai/protocol` package is the single home for wire concerns. Cryptography is folded in here (not a separate package).

### Connection model

```
Runner ──dials──▶ Orchestrator (WebSocket server)
         ◀── signed frames in both directions ──▶
```

- The **orchestrator** listens; the **runner** connects.
- Both sides sign every frame with ed25519.
- Public keys are pre-shared before connection.
- Frames from unknown keys or with invalid signatures are silently dropped.

### Signed envelope

Every WebSocket message is a JSON-encoded signed envelope:

```typescript
type SignedEnvelope = {
  payload: FramePayload;
  signature: string; // base64 ed25519 signature
  keyId: string; // identifies the signing key
  algorithm: "ed25519";
  timestamp: number; // epoch ms
};
```

Signing material is built from a **deterministically canonicalized** JSON representation of `{ algorithm, keyId, payload, timestamp }`. Object keys are sorted recursively so signer and verifier always agree on the byte sequence, regardless of insertion order.

### Frame types

| Kind           | Direction             | Purpose                                           |
| -------------- | --------------------- | ------------------------------------------------- |
| `heartbeat`    | Runner → Orchestrator | Announce `runnerId`, keep peer alive              |
| `rpc.request`  | Either                | Method call with `id`, `method`, `params`         |
| `rpc.response` | Either                | Result or error for a request `id`                |
| `rpc.stream`   | Either                | Ordered streaming events (`data`, `end`, `error`) |

### Peer API

**Orchestrator side** — `createOrchestratorPeer(options)`:

- Starts a WebSocket server on `host`/`port`.
- `onPeerConnect` / `onPeerDisconnect` callbacks.
- `send(peerId, payload)` to target a connected runner.
- Each connection gets an opaque `peerId` (UUID).

**Runner side** — `createRunnerPeer(options)`:

- Dials `url` (e.g. `ws://127.0.0.1:9100`).
- `subscribe(filter, callback)` for incoming frames.
- `send(payload)` for outgoing frames.

Both peers take `identity` (keypair) and `trustedPublicKeys` (map of keyId → public key).

### Key management

```typescript
generateKeyPair(keyId?)   // create ed25519 pair; keyId defaults to public key fingerprint
loadKeyPair({ privateKeyPem, publicKeyPem, keyId })
exportPublicKeyPem / exportPrivateKeyPem
fingerprintPublicKey    // sha256(SPKI DER), base64url, first 16 chars
```

Uses Node built-in `crypto` only — no external signing libraries.

### Orchestrator ↔ runner RPC contract

The protocol package defines the transport. The orchestrator package defines the application-level RPC methods on top:

**Orchestrator → Runner:**

| Method     | Params     | Notes                                                     |
| ---------- | ---------- | --------------------------------------------------------- |
| `dispatch` | `WorkItem` | Runner must respond with `{ accepted: boolean, reason? }` |

**Runner → Orchestrator:**

| Method                               | Params                                             | Notes                       |
| ------------------------------------ | -------------------------------------------------- | --------------------------- |
| `workItem.complete`                  | `{ workItemId }`                                   |                             |
| `workItem.fail`                      | `{ workItemId, message? }`                         |                             |
| `workItem.pause`                     | `{ workItemId }`                                   |                             |
| `workItemSource.setState`            | `{ workItemId, state }`                            | Proxied to work item source |
| `workItemSource.createDraftWorkItem` | `{ input }`                                        | Proxied to work item source |
| `workItemSource.startWorkItem`       | `{ workItemId }`                                   | Proxied to work item source |
| `workItemSource.setDependency`       | `{ blockerId, relationship: "blocks", blockedId }` | Proxied to work item source |
| `workItemSource.getDependencies`     | `{ workItemId }`                                   | Proxied to work item source |
| `workItemSource.getWorkItemStatus`   | `{ workItemId }`                                   | Proxied to work item source |

## Alternatives rejected

| Alternative                                              | Why rejected                                              |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Separate `crypto` package                                | Folded into `protocol`                                    |
| HTTP + SSE                                               | WebSocket chosen for bidirectional, persistent connection |
| In-process direct-call transport                         | One interface only, always over socket                    |
| External signing library (`@noble/ed25519`, `tweetnacl`) | Node `crypto` ed25519 is sufficient                       |

## Verification

Acceptance criteria from the issue:

- Sign → verify round-trip passes
- Tampered payload, wrong key, and unstable canonicalization each fail verification
- Loopback WebSocket server+client exchanges signed RPC frames; requests round-trip; tampered frames rejected
- No in-process direct-call transport exists

See `packages/protocol/src/sign.spec.ts` and `packages/protocol/src/loopback.spec.ts`.

For implementation-level detail (canonicalization algorithm, connection lifecycle, frame validation), see [packages/protocol/README.md](../packages/protocol/README.md).
