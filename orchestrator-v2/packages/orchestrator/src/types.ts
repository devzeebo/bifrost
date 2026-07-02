import type { TaskSource } from "@bifrost-ai/interfaces-task-source";
import type { FramePayload, PeerIdentity } from "@bifrost-ai/protocol";
import type { KeyObject } from "node:crypto";

export type Scheduler = {
  call(method: string, params: unknown): Promise<unknown>;
};

export type OrchestratorOptions = {
  identity: PeerIdentity;
  authorizedRunners: ReadonlyMap<string, KeyObject>;
  taskSource: TaskSource;
  scheduler: Scheduler;
  host?: string;
  port?: number;
  heartbeatTimeoutMs?: number;
  maxInFlightPerPeer?: number;
};

export type DispatchAck = {
  accepted: boolean;
  reason?: string;
};

export type InFlightEntry = {
  taskId: string;
  peerId: string;
};

export function isHeartbeat(payload: FramePayload): boolean {
  return payload.kind === "heartbeat";
}

export function isRpcRequest(payload: FramePayload): boolean {
  return payload.kind === "rpc.request";
}

export function isRpcResponse(payload: FramePayload): boolean {
  return payload.kind === "rpc.response";
}

export function isDispatchAck(payload: FramePayload): boolean {
  return payload.kind === "rpc.response";
}
