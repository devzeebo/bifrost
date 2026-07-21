import type {
  CreateDraftWorkItemInput,
  WorkItemSource,
  WorkItemMetadataPatch,
} from "@bifrost-ai/interfaces-work";
import { isFlowEntry } from "@bifrost-ai/interfaces-work";
import type { ConnectedPeer, FramePayload } from "@bifrost-ai/protocol";
import { parentWorkItemIdFrom } from "@bifrost-ai/ui-events";

import { sendRpcError, sendRpcResponse } from "./dispatcher.js";
import type { ResultHandler } from "./result-handler.js";
import type { UiEventBus } from "./ui-event-bus.js";

export class RpcRouter {
  constructor(
    private readonly workItemSource: WorkItemSource,
    private readonly results: ResultHandler,
    private readonly uiEvents: UiEventBus,
  ) {}

  handle(peer: ConnectedPeer, payload: FramePayload): void {
    if (payload.kind !== "rpc.request") {
      return;
    }

    void this.route(peer, payload.id, payload.method, payload.params).catch((error) => {
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
      case "workItemSource.createDraftWorkItem":
        await this.handleCreateDraftWorkItem(peer, requestId, params);
        return;
      case "workItemSource.startWorkItem":
        await this.handleStartWorkItem(peer, requestId, params);
        return;
      case "workItemSource.setDependency":
        await this.handleSetDependency(peer, requestId, params);
        return;
      case "workItemSource.getDependencies":
        await this.handleGetDependencies(peer, requestId, params);
        return;
      case "workItemSource.getWorkItemStatus":
        await this.handleGetWorkItemStatus(peer, requestId, params);
        return;
      case "workItemSource.updateWorkItemMetadata":
        await this.handleUpdateWorkItemMetadata(peer, requestId, params);
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

  private async handleCreateDraftWorkItem(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const parsed = readCreateDraftParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "input is required");
      return;
    }

    try {
      const workItemId = await this.workItemSource.createDraftWorkItem(parsed.input);
      this.uiEvents.upsert({
        workItemId,
        kind: parsed.input.kind,
        name: parsed.input.name,
        status: "draft",
        parentWorkItemId: parentWorkItemIdFrom(parsed.input.state, parsed.input.metadata),
      });
      sendRpcResponse(peer, requestId, { workItemId });
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
    }
  }

  private async handleStartWorkItem(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const workItemId = readWorkItemId(params);
    if (workItemId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId is required");
      return;
    }

    try {
      await this.workItemSource.startWorkItem(workItemId);
      this.uiEvents.updateStatus(workItemId, "live");
      sendRpcResponse(peer, requestId, { ok: true });
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
    }
  }

  private async handleSetDependency(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const parsed = readSetDependencyParams(params);
    if (parsed === null) {
      sendRpcError(
        peer,
        requestId,
        "INVALID_PARAMS",
        "blockerId, relationship, and blockedId are required",
      );
      return;
    }

    try {
      await this.workItemSource.setDependency(
        parsed.blockerId,
        parsed.relationship,
        parsed.blockedId,
      );
      sendRpcResponse(peer, requestId, { ok: true });
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
    }
  }

  private async handleGetDependencies(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const workItemId = readWorkItemId(params);
    if (workItemId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId is required");
      return;
    }

    try {
      const dependencies = await this.workItemSource.getDependencies(workItemId);
      sendRpcResponse(peer, requestId, dependencies);
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
    }
  }

  private async handleGetWorkItemStatus(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const workItemId = readWorkItemId(params);
    if (workItemId === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId is required");
      return;
    }

    try {
      const status = await this.workItemSource.getWorkItemStatus(workItemId);
      sendRpcResponse(peer, requestId, { status });
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
    }
  }

  private async handleUpdateWorkItemMetadata(
    peer: ConnectedPeer,
    requestId: string,
    params: unknown,
  ): Promise<void> {
    const parsed = readUpdateWorkItemMetadataParams(params);
    if (parsed === null) {
      sendRpcError(peer, requestId, "INVALID_PARAMS", "workItemId and patch are required");
      return;
    }

    try {
      await this.workItemSource.updateWorkItemMetadata(parsed.workItemId, parsed.patch);
      sendRpcResponse(peer, requestId, { ok: true });
    } catch (error) {
      sendRpcError(peer, requestId, "SOURCE_ERROR", error);
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

function readWorkItemId(params: unknown): string | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as { workItemId?: unknown };
  return typeof record.workItemId === "string" ? record.workItemId : null;
}

function readCreateDraftParams(params: unknown): { input: CreateDraftWorkItemInput } | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as { input?: unknown };
  if (record.input === null || typeof record.input !== "object") {
    return null;
  }
  const input = record.input as Partial<CreateDraftWorkItemInput>;
  if (typeof input.kind !== "string") {
    return null;
  }
  if (typeof input.name !== "string") {
    return null;
  }
  if (
    input.flow !== undefined &&
    (!Array.isArray(input.flow) || !input.flow.every((entry) => isFlowEntry(entry)))
  ) {
    return null;
  }
  if (
    input.state !== undefined &&
    (input.state === null || typeof input.state !== "object" || Array.isArray(input.state))
  ) {
    return null;
  }
  if (
    input.metadata !== undefined &&
    (input.metadata === null || typeof input.metadata !== "object" || Array.isArray(input.metadata))
  ) {
    return null;
  }
  return { input: record.input as CreateDraftWorkItemInput };
}

function readSetDependencyParams(
  params: unknown,
): { blockerId: string; relationship: "blocks"; blockedId: string } | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as {
    blockerId?: unknown;
    relationship?: unknown;
    blockedId?: unknown;
  };
  if (
    typeof record.blockerId !== "string" ||
    record.relationship !== "blocks" ||
    typeof record.blockedId !== "string"
  ) {
    return null;
  }
  return {
    blockerId: record.blockerId,
    relationship: record.relationship,
    blockedId: record.blockedId,
  };
}

function readUpdateWorkItemMetadataParams(
  params: unknown,
): { workItemId: string; patch: WorkItemMetadataPatch } | null {
  if (params === null || typeof params !== "object") {
    return null;
  }
  const record = params as { workItemId?: unknown; patch?: unknown };
  if (typeof record.workItemId !== "string") {
    return null;
  }
  if (record.patch === null || typeof record.patch !== "object" || Array.isArray(record.patch)) {
    return null;
  }
  return {
    workItemId: record.workItemId,
    patch: record.patch as WorkItemMetadataPatch,
  };
}
