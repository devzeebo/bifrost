import type { WorkItemSource } from "@bifrost-ai/interfaces-work";
import type { ConnectedPeer } from "@bifrost-ai/protocol";

import { recordBestEffort } from "./best-effort.js";
import { sendRpcError, sendRpcResponse } from "./dispatcher.js";
import type { DispatchTracker } from "./dispatch-tracker.js";
import type { PeerRegistry } from "./peer-registry.js";

export class ResultHandler {
  constructor(
    private readonly workItemSource: WorkItemSource,
    private readonly tracker: DispatchTracker,
    private readonly registry: PeerRegistry,
  ) {}

  async handleComplete(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const workItemId = readWorkItemId(params);
    if (workItemId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId is required");
      return;
    }

    const entry = this.tracker.resolve(workItemId);
    if (entry === undefined || entry.peerId !== peer.peerId) {
      sendRpcError(
        peer,
        requestId,
        "NOT_IN_FLIGHT",
        `Work item ${workItemId} is not in-flight on this peer`,
      );
      return;
    }

    await this.settle(
      peer,
      requestId,
      () => this.workItemSource.completeWorkItem(workItemId),
      "complete work item",
    );
  }

  async handleFail(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const parsed = readFailParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId is required");
      return;
    }

    const entry = this.tracker.resolve(parsed.workItemId);
    if (entry === undefined || entry.peerId !== peer.peerId) {
      sendRpcError(
        peer,
        requestId,
        "NOT_IN_FLIGHT",
        `Work item ${parsed.workItemId} is not in-flight on this peer`,
      );
      return;
    }

    await this.settle(
      peer,
      requestId,
      () => this.workItemSource.failWorkItem(parsed.workItemId, parsed.message),
      "fail work item",
    );
  }

  async handlePause(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const workItemId = readWorkItemId(params);
    if (workItemId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId is required");
      return;
    }

    const entry = this.tracker.resolve(workItemId);
    if (entry === undefined || entry.peerId !== peer.peerId) {
      sendRpcError(
        peer,
        requestId,
        "NOT_IN_FLIGHT",
        `Work item ${workItemId} is not in-flight on this peer`,
      );
      return;
    }

    await this.settle(
      peer,
      requestId,
      () => this.workItemSource.pauseWorkItem(workItemId),
      "pause work item",
    );
  }

  handleDisconnect(peer: ConnectedPeer): void {
    const orphaned = this.tracker.failByPeer(peer.peerId);
    for (const entry of orphaned) {
      void recordBestEffort(
        () => this.workItemSource.failWorkItem(entry.workItemId, "Runner disconnected"),
        "fail orphaned work item",
      );
      this.registry.markTerminal(peer.peerId);
    }
  }

  // Record the terminal outcome best-effort, then always free the peer's slot and
  // answer the runner. A throwing work-item-source callback must not leak the
  // in-flight slot, hang the runner's RPC, or escape as an unhandled rejection.
  private async settle(
    peer: ConnectedPeer,
    requestId: string,
    record: () => Promise<void>,
    context: string,
  ): Promise<void> {
    await recordBestEffort(record, context);
    this.registry.markTerminal(peer.peerId);
    sendRpcResponse(peer, requestId, { ok: true });
  }
}

function readWorkItemId(params: unknown): string | null {
  if (params === null || typeof params !== "object" || !("workItemId" in params)) {
    return null;
  }
  const workItemId = (params as { workItemId: unknown }).workItemId;
  return typeof workItemId === "string" ? workItemId : null;
}

function readFailParams(params: unknown): { workItemId: string; message: string } | null {
  const workItemId = readWorkItemId(params);
  if (workItemId === null) {
    return null;
  }
  let message = "failed";
  if (params !== null && typeof params === "object" && "message" in params) {
    const raw = (params as { message: unknown }).message;
    if (typeof raw === "string" && raw.length > 0) {
      message = raw;
    }
  }
  return { workItemId, message };
}
