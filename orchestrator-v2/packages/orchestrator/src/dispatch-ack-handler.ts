import type { TaskSource } from "@bifrost-ai/interfaces-task-source";
import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

import type { DispatchTracker } from "./dispatch-tracker.js";
import type { PeerRegistry } from "./peer-registry.js";
import type { DispatchAck } from "./types.js";

export class DispatchAckHandler {
  constructor(
    private readonly taskSource: TaskSource,
    private readonly tracker: DispatchTracker,
    private readonly registry: PeerRegistry,
  ) {}

  handle(peer: ConnectedPeer, payload: FramePayload): void {
    if (payload.kind !== "rpc.response") {
      return;
    }

    const entry = this.tracker.lookupByDispatchId(payload.id);
    if (entry === undefined) {
      return;
    }

    if (payload.error !== undefined) {
      void this.reject(peer.peerId, entry.taskId, payload.error.message);
      return;
    }

    const ack = payload.result as DispatchAck | undefined;
    if (ack === undefined || typeof ack !== "object" || !("accepted" in ack)) {
      void this.reject(peer.peerId, entry.taskId, "Invalid dispatch ack");
      return;
    }

    if (!ack.accepted) {
      void this.reject(peer.peerId, entry.taskId, ack.reason ?? "Dispatch rejected");
      return;
    }
  }

  private async reject(peerId: string, taskId: string, reason: string): Promise<void> {
    this.tracker.resolve(taskId);
    this.registry.markDispatchRejected(peerId);
    await this.taskSource.failTask(taskId, reason);
  }
}
