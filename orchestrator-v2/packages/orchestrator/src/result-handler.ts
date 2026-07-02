import type { TaskSource } from "@bifrost-ai/interfaces-task-source";
import type { ConnectedPeer } from "@bifrost-ai/protocol";

import { sendRpcError, sendRpcResponse } from "./dispatcher.js";
import type { DispatchTracker } from "./dispatch-tracker.js";
import type { PeerRegistry } from "./peer-registry.js";

export class ResultHandler {
  constructor(
    private readonly taskSource: TaskSource,
    private readonly tracker: DispatchTracker,
    private readonly registry: PeerRegistry,
  ) {}

  async handleComplete(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const taskId = readTaskId(params);
    if (taskId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "taskId is required");
      return;
    }

    const entry = this.tracker.resolve(taskId);
    if (entry === undefined || entry.peerId !== peer.peerId) {
      sendRpcError(
        peer,
        requestId,
        "NOT_IN_FLIGHT",
        `Task ${taskId} is not in-flight on this peer`,
      );
      return;
    }

    await this.taskSource.completeTask(taskId);
    this.registry.markTerminal(peer.peerId);
    sendRpcResponse(peer, requestId, { ok: true });
  }

  async handleFail(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const parsed = readFailParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "taskId is required");
      return;
    }

    const entry = this.tracker.resolve(parsed.taskId);
    if (entry === undefined || entry.peerId !== peer.peerId) {
      sendRpcError(
        peer,
        requestId,
        "NOT_IN_FLIGHT",
        `Task ${parsed.taskId} is not in-flight on this peer`,
      );
      return;
    }

    await this.taskSource.failTask(parsed.taskId, parsed.message);
    this.registry.markTerminal(peer.peerId);
    sendRpcResponse(peer, requestId, { ok: true });
  }

  async handlePause(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const taskId = readTaskId(params);
    if (taskId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "taskId is required");
      return;
    }

    const entry = this.tracker.resolve(taskId);
    if (entry === undefined || entry.peerId !== peer.peerId) {
      sendRpcError(
        peer,
        requestId,
        "NOT_IN_FLIGHT",
        `Task ${taskId} is not in-flight on this peer`,
      );
      return;
    }

    await this.taskSource.pauseTask(taskId);
    this.registry.markTerminal(peer.peerId);
    sendRpcResponse(peer, requestId, { ok: true });
  }

  handleDisconnect(peer: ConnectedPeer): void {
    const orphaned = this.tracker.failByPeer(peer.peerId);
    for (const entry of orphaned) {
      void this.taskSource.failTask(entry.taskId, "Runner disconnected");
      this.registry.markTerminal(peer.peerId);
    }
  }
}

function readTaskId(params: unknown): string | null {
  if (params === null || typeof params !== "object" || !("taskId" in params)) {
    return null;
  }
  const taskId = (params as { taskId: unknown }).taskId;
  return typeof taskId === "string" ? taskId : null;
}

function readFailParams(params: unknown): { taskId: string; message: string } | null {
  const taskId = readTaskId(params);
  if (taskId === null) {
    return null;
  }
  let message = "failed";
  if (params !== null && typeof params === "object" && "message" in params) {
    const raw = (params as { message: unknown }).message;
    if (typeof raw === "string" && raw.length > 0) {
      message = raw;
    }
  }
  return { taskId, message };
}
