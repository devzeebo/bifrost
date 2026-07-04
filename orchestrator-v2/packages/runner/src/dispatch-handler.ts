import {
  missingWorkItemFields,
  missingWorkItemFieldsMessage,
  validateWorkItem,
} from "@bifrost-ai/interfaces-work";
import type { DataRegistry, WorkItemHandler } from "@bifrost-ai/interfaces-work";
import type { FramePayload, RunnerPeer } from "@bifrost-ai/protocol";

import { executeWorkItem } from "./execute-work-item.js";
import { sendRpcResponse, type RpcClient } from "./rpc-client.js";
import { createRpcWorkItemExecutionContext } from "./work-item-execution-context.js";
import type { Registry } from "./registry.js";

export function registerDispatchHandler(
  peer: RunnerPeer,
  handlers: Map<string, Registry<WorkItemHandler>>,
  data: DataRegistry<Record<string, unknown>>,
  rpc: RpcClient,
): () => void {
  return peer.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.method === "dispatch",
    (payload) => {
      void handleDispatch(peer, handlers, data, rpc, payload).catch(() => undefined);
    },
  );
}

async function handleDispatch(
  peer: RunnerPeer,
  handlers: Map<string, Registry<WorkItemHandler>>,
  data: DataRegistry<Record<string, unknown>>,
  rpc: RpcClient,
  payload: FramePayload,
): Promise<void> {
  if (payload.kind !== "rpc.request") {
    return;
  }

  const workItem = payload.params;
  if (!validateWorkItem(workItem)) {
    const missing = missingWorkItemFields(workItem);
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: missingWorkItemFieldsMessage(missing),
    });
    return;
  }

  const handler = handlers.get(workItem.kind)?.get(workItem.name);
  if (handler === undefined) {
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: `Unknown work item handler: ${workItem.kind}/${workItem.name}`,
    });
    return;
  }

  sendRpcResponse(peer, payload.id, { accepted: true });

  const { workItem: liveWorkItem, ctx } = createRpcWorkItemExecutionContext(
    workItem,
    rpc,
    data,
    handlers,
  );
  const result = await executeWorkItem(handler, liveWorkItem, ctx);

  switch (result.outcome) {
    case "completed":
      await rpc.call("workItem.complete", { workItemId: workItem.workItemId });
      break;
    case "failed":
      await rpc.call("workItem.fail", {
        workItemId: workItem.workItemId,
        message: result.message ?? "failed",
      });
      break;
    case "paused":
      await rpc.call("workItem.pause", { workItemId: workItem.workItemId });
      break;
  }
}
