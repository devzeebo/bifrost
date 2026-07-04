import type { WorkItemSource } from "@bifrost-ai/interfaces-work";
import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";

import { sendRpcError, sendRpcResponse } from "./dispatcher.js";
import type { ResultHandler } from "./result-handler.js";
import type { Scheduler } from "./types.js";

export class RpcRouter {
  constructor(
    private readonly workItemSource: WorkItemSource,
    private readonly scheduler: Scheduler,
    private readonly results: ResultHandler,
  ) {}

  handle(peer: ConnectedPeer, payload: FramePayload): void {
    if (payload.kind !== "rpc.request") {
      return;
    }

    void this.route(peer, payload.id, payload.method, payload.params).catch((error) => {
      // Backstop for the whole RPC surface: any handler that throws before it
      // answers still gets a response back to the runner, so a bug in one path
      // can't hang the runner. Per-handler catches below just refine the code.
      console.error(`Failed to route RPC ${payload.method}:`, error);
      sendRpcError(peer, payload.id, "INTERNAL_ERROR", error);
    });
  }

  private async route(
    peer: ConnectedPeer,
    requestId: string,
    method: string,
    params: unknown,
  ): Promise<void> {
    switch (method) {
      case "workItem.complete":
        await this.results.handleComplete(peer, requestId, params);
        return;
      case "workItem.fail":
        await this.results.handleFail(peer, requestId, params);
        return;
      case "workItem.pause":
        await this.results.handlePause(peer, requestId, params);
        return;
      case "workItemSource.setState":
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
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId and state are required");
      return;
    }

    try {
      await this.workItemSource.setState(parsed.workItemId, parsed.state);
      sendRpcResponse(peer, requestId, { ok: true });
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
    }
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

    try {
      const result = await this.scheduler.call(parsed.method, parsed.args);
      sendRpcResponse(peer, requestId, result);
    } catch (error) {
      sendRpcError(peer, requestId, "SCHEDULER_ERROR", error);
    }
  }
}

function readSetStateParams(
  params: unknown,
): { workItemId: string; state: Record<string, unknown> } | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as { workItemId?: unknown; state?: unknown };
  if (typeof record.workItemId !== "string") {
    return null;
  }
  if (record.state === null || typeof record.state !== "object") {
    return null;
  }
  return {
    workItemId: record.workItemId,
    state: record.state as Record<string, unknown>,
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
