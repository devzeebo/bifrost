import {
  missingTaskFields,
  missingTaskFieldsMessage,
  validateTask,
} from "@bifrost-ai/interfaces-task-source";
import type { DataRegistry, ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";
import type { FramePayload, RunnerPeer } from "@bifrost-ai/protocol";

import { executeScript } from "./execute-script.js";
import { sendRpcResponse, type RpcClient } from "./rpc-client.js";
import { createRpcScriptContext } from "./script-context.js";
import type { Registry } from "./registry.js";

export function registerDispatchHandler(
  peer: RunnerPeer,
  agents: Map<string, Registry<ScriptTaskDefinition>>,
  data: DataRegistry<Record<string, unknown>>,
  rpc: RpcClient,
): () => void {
  return peer.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.method === "dispatch",
    (payload) => {
      void handleDispatch(peer, agents, data, rpc, payload);
    },
  );
}

async function handleDispatch(
  peer: RunnerPeer,
  agents: Map<string, Registry<ScriptTaskDefinition>>,
  data: DataRegistry<Record<string, unknown>>,
  rpc: RpcClient,
  payload: FramePayload,
): Promise<void> {
  if (payload.kind !== "rpc.request") {
    return;
  }

  const task = payload.params;
  if (!validateTask(task)) {
    const missing = missingTaskFields(task);
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: missingTaskFieldsMessage(missing),
    });
    return;
  }

  const handler = agents.get(task.agentType)?.get(task.agentName);
  if (handler === undefined) {
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: `Unknown agent: ${task.agentName}`,
    });
    return;
  }

  sendRpcResponse(peer, payload.id, { accepted: true });

  const ctx = createRpcScriptContext(task, rpc, data, agents);
  const result = await executeScript(handler, ctx);

  switch (result.outcome) {
    case "completed":
      await rpc.call("task.complete", { taskId: task.taskId });
      break;
    case "failed":
      await rpc.call("task.fail", {
        taskId: task.taskId,
        message: result.message ?? "failed",
      });
      break;
    case "paused":
      await rpc.call("task.pause", { taskId: task.taskId });
      break;
  }
}
