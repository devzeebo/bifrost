import type { WorkItemSource } from "@bifrost-ai/interfaces-work";
import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

import { recordBestEffort } from "./best-effort.js";
import type { DispatchTracker } from "./dispatch-tracker.js";
import type { PeerRegistry } from "./peer-registry.js";
import type { DispatchAck } from "./types.js";
import type { UiEventBus } from "./ui-event-bus.js";

export class DispatchAckHandler {
  constructor(
    private readonly workItemSource: WorkItemSource,
    private readonly tracker: DispatchTracker,
    private readonly registry: PeerRegistry,
    private readonly uiEvents: UiEventBus,
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
      this.reject(peer.peerId, entry.workItemId, payload.error.message);
      return;
    }

    const ack = payload.result as DispatchAck | undefined;
    if (ack === undefined || typeof ack !== "object" || !("accepted" in ack)) {
      this.reject(peer.peerId, entry.workItemId, "Invalid dispatch ack");
      return;
    }

    if (!ack.accepted) {
      this.reject(peer.peerId, entry.workItemId, ack.reason ?? "Dispatch rejected");
    }
  }

  private reject(peerId: string, workItemId: string, reason: string): void {
    this.tracker.resolve(workItemId);
    this.registry.markDispatchRejected(peerId);
    void recordBestEffort(
      () => this.workItemSource.failWorkItem(workItemId, reason),
      "fail rejected work item",
    );
    this.uiEvents.markTerminal(workItemId, "failed");
  }
}
