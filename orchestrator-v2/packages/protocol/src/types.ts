export type RpcRequest = {
  kind: "rpc.request";
  id: string;
  method: string;
  params: unknown;
};

export type RpcResponse = {
  kind: "rpc.response";
  id: string;
  result?: unknown;
  error?: { code: string; message: string };
};

export type RpcStreamEvent = {
  kind: "rpc.stream";
  id: string;
  seq: number;
  event: "data" | "end" | "error";
  data?: unknown;
  error?: { code: string; message: string };
};

export type Heartbeat = {
  kind: "heartbeat";
  runnerId: string;
  // Optional capability advertisement: the capabilityKey() of every agent the runner
  // has registered. Absent means "unknown" -- the orchestrator then treats the runner
  // as able to handle any task (backward compatible with runners that don't advertise).
  capabilities?: string[];
};

// Canonical wire form of a runner capability: the (agentType, agentName) pair a task
// requires and a runner advertises. Both sides MUST derive keys via this helper so
// advertised and required capabilities compare byte-for-byte.
export function capabilityKey(agentType: string, agentName: string): string {
  return JSON.stringify([agentType, agentName]);
}

export type FramePayload = RpcRequest | RpcResponse | RpcStreamEvent | Heartbeat;

export const SIGNING_ALGORITHM = "ed25519" as const;

export type SignedEnvelope<T = FramePayload> = {
  payload: T;
  signature: string;
  keyId: string;
  algorithm: typeof SIGNING_ALGORITHM;
  timestamp: number;
};

export type UnsignedEnvelope<T = FramePayload> = {
  payload: T;
  keyId: string;
  algorithm: typeof SIGNING_ALGORITHM;
  timestamp: number;
};

export type RunnerPeer = {
  subscribe(
    filter: (payload: FramePayload) => boolean,
    callback: (payload: FramePayload) => void,
  ): () => void;
  send(payload: FramePayload): void;
  close(): void;
};

export type ConnectedPeer = {
  readonly peerId: string;
  subscribe(
    filter: (payload: FramePayload) => boolean,
    callback: (payload: FramePayload) => void,
  ): () => void;
  send(payload: FramePayload): void;
  close(): void;
};

export type OrchestratorPeer = {
  readonly address: { host: string; port: number };
  onPeerConnect(callback: (peer: ConnectedPeer) => void): () => void;
  onPeerDisconnect(callback: (peer: ConnectedPeer) => void): () => void;
  send(peerId: string, payload: FramePayload): void;
  close(): void;
};

export type PeerIdentity = {
  keyId: string;
  publicKey: import("node:crypto").KeyObject;
  privateKey: import("node:crypto").KeyObject;
};

export type PeerOptions = {
  identity: PeerIdentity;
  trustedPublicKeys: ReadonlyMap<string, import("node:crypto").KeyObject>;
};

export type CreateRunnerPeerOptions = PeerOptions & {
  url: string;
};

export type CreateOrchestratorPeerOptions = PeerOptions & {
  port?: number;
  host?: string;
};
