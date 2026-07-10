import {
  missingWorkItemFields,
  missingWorkItemFieldsMessage,
  validateWorkItem,
} from "@bifrost-ai/interfaces-work";
import type { DataRegistry, DecoratorFn, ScriptFn } from "@bifrost-ai/interfaces-work";
import type { FramePayload, RunnerPeer } from "@bifrost-ai/protocol";

import { sendRpcResponse, type RpcClient } from "./rpc-client.js";
import { createScriptContext } from "./script-context.js";
import { executeScriptStack, resolveStack } from "./script-stack.js";
import type { Registry } from "./registry.js";

export type DispatchScriptStack<TData extends Record<string, unknown>> = {
  scripts: Registry<ScriptFn<TData>>;
  decorators: Registry<DecoratorFn<TData>>;
  conventions: readonly string[];
  data: DataRegistry<TData>;
  rpc: RpcClient;
};

export function registerDispatchHandler<TData extends Record<string, unknown>>(
  peer: RunnerPeer,
  stack: DispatchScriptStack<TData>,
): () => void {
  return peer.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.method === "dispatch",
    (payload) => {
      void handleDispatch(peer, stack, payload).catch(() => undefined);
    },
  );
}

async function handleDispatch<TData extends Record<string, unknown>>(
  peer: RunnerPeer,
  stack: DispatchScriptStack<TData>,
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

  let resolved;
  try {
    resolved = resolveStack(workItem, stack.scripts, stack.decorators, stack.conventions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: message,
    });
    return;
  }

  sendRpcResponse(peer, payload.id, { accepted: true });

  const { workItem: liveWorkItem, ctx } = createScriptContext(workItem, stack.rpc, stack.data);
  const result = await executeScriptStack(liveWorkItem, ctx, resolved);

  switch (result.outcome) {
    case "completed":
      await stack.rpc.call("workItem.complete", { workItemId: workItem.workItemId });
      break;
    case "failed":
      await stack.rpc.call("workItem.fail", {
        workItemId: workItem.workItemId,
        message: result.message ?? "failed",
      });
      break;
    case "paused":
      await stack.rpc.call("workItem.pause", { workItemId: workItem.workItemId });
      break;
  }
}
