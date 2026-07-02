# @bifrost-ai/protocol

Signed WebSocket RPC transport for runner ↔ orchestrator communication in Bifrost v2.

This package is the **only** wire interface between runners and the orchestrator. There is no in-process direct-call variant — a co-located runner still dials the orchestrator over WebSocket.

Design background: [docs/protocol.md](../../docs/protocol.md) · Issue [#33](https://github.com/devzeebo/bifrost/issues/33)

## Purpose

v2 splits task execution onto remote runners. This package provides:

1. **ed25519 signing and verification** using Node built-in `crypto`
2. **Deterministic JSON canonicalization** so signers and verifiers agree on signing material
3. **WebSocket frame encoding/decoding** with envelope validation
4. **Peer abstractions** for orchestrator (server) and runner (client) roles

Cryptography is intentionally folded into this package rather than living in a separate `crypto` package.

## Public API

### Key management (`keys.ts`)

```typescript
generateKeyPair(keyId?: string): PeerIdentity
loadKeyPair({ privateKeyPem, publicKeyPem, keyId }): PeerIdentity
exportPublicKeyPem(publicKey): string
exportPrivateKeyPem(privateKey): string
fingerprintPublicKey(publicKey): string  // sha256(SPKI) → base64url, 16 chars
```

`PeerIdentity` is `{ keyId, publicKey, privateKey }`. When `keyId` is omitted from `generateKeyPair`, it defaults to the public key fingerprint.

### Signing (`sign.ts`)

```typescript
signPayload(payload, identity, timestamp?): SignedEnvelope
verifyEnvelope(envelope, trustedPublicKeys): boolean
buildSigningMaterial(unsignedEnvelope): string
```

`signPayload` wraps a `FramePayload` in a `SignedEnvelope`. `verifyEnvelope` checks the signature against `trustedPublicKeys.get(envelope.keyId)`. Returns `false` on any mismatch — wrong algorithm, unknown keyId, bad base64, or signature failure.

### Canonicalization (`canonicalize.ts`)

```typescript
canonicalize(value: unknown): string  // JSON.stringify with sorted object keys
```

Recursively sorts object keys before `JSON.stringify`. This ensures that `{ b: 1, a: 2 }` and `{ a: 2, b: 1 }` produce identical signing material. Arrays preserve element order.

Signing material is the canonical JSON of:

```json
{ "algorithm": "ed25519", "keyId": "...", "payload": { ... }, "timestamp": 1234567890 }
```

### Frames (`frames.ts`)

```typescript
encodeEnvelope(envelope: SignedEnvelope): string   // JSON.stringify
decodeEnvelope(raw: string): SignedEnvelope | null
isFramePayload(value: unknown): value is FramePayload
```

`decodeEnvelope` returns `null` for malformed JSON, missing fields, or invalid payload kinds. It does not verify signatures — that happens in the connection layer.

### Connection (`connection.ts`)

```typescript
createProtocolConnection(socket, { identity, trustedPublicKeys, onClose? }): ProtocolConnection
toConnectedPeer(peerId, connection): ConnectedPeer
```

`createProtocolConnection` wraps a raw `ws` WebSocket:

- **Inbound:** decode envelope → verify signature → validate payload kind → dispatch to subscribers matching their filter.
- **Outbound:** sign payload with local identity → encode envelope → `socket.send`.
- Invalid or untrusted frames are silently dropped (no error frame).
- `onClose` fires once when the socket closes or errors.

### Peers

**Orchestrator** (`orchestrator.ts`):

```typescript
createOrchestratorPeer({ identity, trustedPublicKeys, host?, port? }): Promise<OrchestratorPeer>
```

- Creates a `WebSocketServer`. `port: 0` binds an ephemeral port.
- Assigns each connection an opaque `peerId` (UUID).
- `onPeerConnect` fires for new and already-connected peers.
- `onPeerDisconnect` fires when a peer's socket closes.
- `send(peerId, payload)` throws if peerId is unknown.

**Runner** (`runner.ts`):

```typescript
createRunnerPeer({ identity, trustedPublicKeys, url }): Promise<RunnerPeer>
```

- Dials the orchestrator URL.
- Resolves when the WebSocket `open` event fires.
- Same subscribe/send/close API as `ProtocolConnection`.

## Frame payload types

```typescript
type RpcRequest = { kind: "rpc.request"; id: string; method: string; params: unknown };
type RpcResponse = {
  kind: "rpc.response";
  id: string;
  result?: unknown;
  error?: { code; message };
};
type RpcStreamEvent = {
  kind: "rpc.stream";
  id: string;
  seq: number;
  event: "data" | "end" | "error";
  data?;
  error?;
};
type Heartbeat = { kind: "heartbeat"; runnerId: string };
```

`rpc.stream` supports ordered streaming responses. The orchestrator package does not use streaming today, but the protocol supports it for future methods.

## Trust model

Both sides maintain a `trustedPublicKeys: Map<keyId, KeyObject>`:

- The **orchestrator** trusts runner public keys (loaded from static config).
- The **runner** trusts the orchestrator's public key.

Every inbound frame is verified against this map. There is no handshake or key exchange at connection time — keys must be pre-shared. An unknown `keyId` causes the frame to be dropped.

## Wire format example

A heartbeat from a runner looks like this on the wire (one WebSocket text frame):

```json
{
  "payload": { "kind": "heartbeat", "runnerId": "runner" },
  "signature": "base64...",
  "keyId": "runner",
  "algorithm": "ed25519",
  "timestamp": 1719900000000
}
```

## Module layout

```
src/
  canonicalize.ts   Deterministic JSON serialization
  connection.ts     WebSocket ↔ signed frame bridge
  frames.ts         Encode/decode/validate envelopes
  keys.ts           ed25519 keypair generation and PEM export
  orchestrator.ts   WebSocket server peer
  runner.ts         WebSocket client peer
  sign.ts           Sign and verify envelopes
  types.ts          Frame and peer type definitions
```

## Tests

- `sign.spec.ts` — round-trip, tamper, wrong key, non-canonical material
- `canonicalize.spec.ts` — key ordering stability
- `loopback.spec.ts` — real WebSocket server+client: RPC round-trip, streaming, disconnect, tampered frame rejection

Run with `vp test` from this package directory.

## Dependencies

- `ws` — WebSocket implementation
- `node:crypto` — ed25519 key generation, sign, verify (no external crypto libraries)
