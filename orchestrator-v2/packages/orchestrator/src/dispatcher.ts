import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";
import type { Task } from "@bifrost-ai/interfaces-task-source";

import { createDispatchId, type DispatchTracker } from "./dispatch-tracker.js";
import type { PeerRegistry } from "./peer-registry.js";

export function dispatchTask(
  peer: ConnectedPeer,
  task: Task,
  tracker: DispatchTracker,
  registry: PeerRegistry,
): string {
  const dispatchId = createDispatchId();
  tracker.register(dispatchId, { taskId: task.taskId, peerId: peer.peerId });
  registry.markDispatched(peer.peerId);
  peer.send({
    kind: "rpc.request",
    id: dispatchId,
    method: "dispatch",
    params: task,
  });
  return dispatchId;
}

export function sendRpcResponse(peer: ConnectedPeer, id: string, result: unknown): void {
  const payload: FramePayload = {
    kind: "rpc.response",
    id,
    result,
  };
  peer.send(payload);
}

export function sendRpcError(peer: ConnectedPeer, id: string, code: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const payload: FramePayload = {
    kind: "rpc.response",
    id,
    error: { code, message },
  };
  peer.send(payload);
}
