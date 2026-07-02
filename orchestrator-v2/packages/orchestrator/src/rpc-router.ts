import type { TaskSource } from "@bifrost-ai/interfaces-task-source";
import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

import { sendRpcError, sendRpcResponse } from "./dispatcher.js";
import type { ResultHandler } from "./result-handler.js";
import type { Scheduler } from "./types.js";

export class RpcRouter {
  constructor(
    private readonly taskSource: TaskSource,
    private readonly scheduler: Scheduler,
    private readonly results: ResultHandler,
  ) {}

  handle(peer: ConnectedPeer, payload: FramePayload): void {
    if (payload.kind !== "rpc.request") {
      return;
    }

    void this.route(peer, payload.id, payload.method, payload.params);
  }

  private async route(
    peer: ConnectedPeer,
    requestId: string,
    method: string,
    params: unknown,
  ): Promise<void> {
    switch (method) {
      case "task.complete":
        await this.results.handleComplete(peer, requestId, params);
        return;
      case "task.fail":
        await this.results.handleFail(peer, requestId, params);
        return;
      case "task.pause":
        await this.results.handlePause(peer, requestId, params);
        return;
      case "taskSource.setState":
        await this.handleSetState(peer, requestId, params);
        return;
      case "scheduler.call":
        await this.handleSchedulerCall(peer, requestId, params);
        return;
      default:
        sendRpcError(peer, requestId, "METHOD_NOT_FOUND", `Unknown method: ${method}`);
    }
  }

  private async handleSetState(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const parsed = readSetStateParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "taskId and taskState are required");
      return;
    }

    await this.taskSource.setState(parsed.taskId, parsed.taskState);
    sendRpcResponse(peer, requestId, { ok: true });
  }

  private async handleSchedulerCall(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const parsed = readSchedulerParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "method and args are required");
      return;
    }

    const result = await this.scheduler.call(parsed.method, parsed.args);
    sendRpcResponse(peer, requestId, result);
  }
}

function readSetStateParams(
  params: unknown,
): { taskId: string; taskState: Record<string, unknown> } | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as { taskId?: unknown; taskState?: unknown };
  if (typeof record.taskId !== "string") {
    return null;
  }
  if (record.taskState === null || typeof record.taskState !== "object") {
    return null;
  }
  return {
    taskId: record.taskId,
    taskState: record.taskState as Record<string, unknown>,
  };
}

function readSchedulerParams(params: unknown): { method: string; args: unknown } | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as { method?: unknown; args?: unknown };
  if (typeof record.method !== "string") {
    return null;
  }
  return { method: record.method, args: record.args };
}
