import { isExecutionStats } from "@bifrost-ai/interfaces-task-source";
import type { ExecutionStats, TaskSource } from "@bifrost-ai/interfaces-task-source";
import type { ConnectedPeer } from "@bifrost-ai/protocol";

import { recordBestEffort } from "./best-effort.js";
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
    await this.settle(peer, requestId, taskId, () =>
      this.taskSource.completeTask(taskId, readTelemetry(params)),
    );
  }

  async handleFail(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const parsed = readFailParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "taskId is required");
      return;
    }
    await this.settle(peer, requestId, parsed.taskId, () =>
      this.taskSource.failTask(parsed.taskId, parsed.message, readTelemetry(params)),
    );
  }

  async handlePause(peer: ConnectedPeer, requestId: string, params: unknown): Promise<void> {
    const taskId = readTaskId(params);
    if (taskId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "taskId is required");
      return;
    }
    await this.settle(peer, requestId, taskId, () => this.taskSource.pauseTask(taskId));
  }

  // Record a terminal outcome, then ALWAYS free the peer slot and answer the runner —
  // even if the task source throws. A source-recording failure must never leak the
  // in-flight slot (which would wedge the peer) nor hang the runner's terminal RPC.
  private async settle(
    peer: ConnectedPeer,
    requestId: string,
    taskId: string,
    record: () => Promise<void>,
  ): Promise<void> {
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
    await recordBestEffort(record, `record outcome for task ${taskId}`);
    this.registry.markTerminal(peer.peerId);
    sendRpcResponse(peer, requestId, { ok: true });
  }

  handleDisconnect(peer: ConnectedPeer): void {
    const orphaned = this.tracker.failByPeer(peer.peerId);
    for (const entry of orphaned) {
      void recordBestEffort(
        () => this.taskSource.failTask(entry.taskId, "Runner disconnected"),
        `fail orphaned task ${entry.taskId}`,
      );
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

function readTelemetry(params: unknown): ExecutionStats | undefined {
  if (params === null || typeof params !== "object" || !("telemetry" in params)) {
    return undefined;
  }
  const telemetry = (params as { telemetry: unknown }).telemetry;
  return isExecutionStats(telemetry) ? telemetry : undefined;
}
