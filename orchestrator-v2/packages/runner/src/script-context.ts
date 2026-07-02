import type { ScriptContext } from "@bifrost-ai/interfaces-task";
import type { Task } from "@bifrost-ai/interfaces-task-source";

import type { RpcClient } from "./rpc-client.js";

export function createRpcScriptContext(task: Task, rpc: RpcClient): ScriptContext {
  const state = { ...task.taskState };

  return {
    taskId: task.taskId,
    agentType: task.agentType,
    agentName: task.agentName,
    get taskState() {
      return state;
    },
    metadata: task.metadata,
    async setState(nextState: Record<string, unknown>) {
      Object.assign(state, nextState);
      await rpc.call("taskSource.setState", {
        taskId: task.taskId,
        taskState: state,
      });
    },
  };
}
