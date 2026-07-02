import type { Task } from "@bifrost-ai/interfaces-task-source";
import type { FramePayload, RunnerPeer } from "@bifrost-ai/protocol";

import { executeScript } from "./execute-script.js";
import { sendRpcResponse, type RpcClient } from "./rpc-client.js";
import { createRpcScriptContext } from "./script-context.js";
import type { ScriptRegistry } from "./script-registry.js";

export function registerDispatchHandler(
  peer: RunnerPeer,
  registry: ScriptRegistry,
  rpc: RpcClient,
): () => void {
  return peer.subscribe(
    (payload) => payload.kind === "rpc.request" && payload.method === "dispatch",
    (payload) => {
      void handleDispatch(peer, registry, rpc, payload);
    },
  );
}

async function handleDispatch(
  peer: RunnerPeer,
  registry: ScriptRegistry,
  rpc: RpcClient,
  payload: FramePayload,
): Promise<void> {
  if (payload.kind !== "rpc.request") {
    return;
  }

  const task = payload.params as Task;
  if (!isTask(task)) {
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: "Invalid dispatch params",
    });
    return;
  }

  if (!registry.has(task.scriptName)) {
    sendRpcResponse(peer, payload.id, {
      accepted: false,
      reason: `Unknown script: ${task.scriptName}`,
    });
    return;
  }

  sendRpcResponse(peer, payload.id, { accepted: true });

  const ctx = createRpcScriptContext(task, rpc);
  const result = await executeScript(registry, task.scriptName, ctx);

  switch (result.outcome) {
    case "completed":
      await rpc.call("task.complete", { taskId: task.id });
      break;
    case "failed":
      await rpc.call("task.fail", {
        taskId: task.id,
        message: result.message ?? "failed",
      });
      break;
    case "paused":
      await rpc.call("task.pause", { taskId: task.id });
      break;
  }
}

function isTask(value: unknown): value is Task {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<Task>;
  return (
    typeof record.id === "string" &&
    typeof record.scriptName === "string" &&
    record.taskState !== null &&
    typeof record.taskState === "object" &&
    record.metadata !== null &&
    typeof record.metadata === "object"
  );
}
