import {
  missingWorkItemFields,
  missingWorkItemFieldsMessage,
  validateWorkItem,
} from "@bifrost-ai/interfaces-work";
import type { DataRegistry, DecoratorFactory, ScriptFn } from "@bifrost-ai/interfaces-work";
import type { FramePayload, RunnerPeer } from "@bifrost-ai/protocol";

import { sendRpcResponse, type RpcClient } from "./rpc-client.js";
import { createScriptContext } from "./script-context.js";
import { executeScriptStack, resolveStack } from "./script-stack.js";
import type { Registry } from "./registry.js";

export type DispatchScriptStack<TData extends Record<string, unknown>> = {
  scripts: Registry<ScriptFn<TData>>;
  decorators: Registry<DecoratorFactory<TData>>;
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
      void handleDispatch(peer, stack, payload).catch((error) => {
        console.error("Unhandled dispatch error:", error);
      });
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
  await executeScriptStack(liveWorkItem, ctx, resolved);
}
