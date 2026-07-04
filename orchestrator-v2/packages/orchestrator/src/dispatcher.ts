import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";
import type { WorkItem } from "@bifrost-ai/interfaces-work";

import { createDispatchId, type DispatchTracker } from "./dispatch-tracker.js";
import type { PeerRegistry } from "./peer-registry.js";

export function dispatchWorkItem(
  peer: ConnectedPeer,
  workItem: WorkItem,
  tracker: DispatchTracker,
  registry: PeerRegistry,
): string {
  const dispatchId = createDispatchId();
  tracker.register(dispatchId, { workItemId: workItem.workItemId, peerId: peer.peerId });
  registry.markDispatched(peer.peerId);
  peer.send({
    kind: "rpc.request",
    id: dispatchId,
    method: "dispatch",
    params: workItem,
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
