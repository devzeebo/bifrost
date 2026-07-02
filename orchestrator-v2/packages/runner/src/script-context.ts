import type {
  DataRegistry,
  ScriptContext,
  ScriptTaskDefinition,
} from "@bifrost-ai/interfaces-task";
import type { Task } from "@bifrost-ai/interfaces-task-source";

import type { RpcClient } from "./rpc-client.js";
import type { Registry } from "./registry.js";

export function createRpcScriptContext<TData extends Record<string, unknown>>(
  task: Task,
  rpc: RpcClient,
  data: DataRegistry<TData>,
  agents: Map<string, Registry<ScriptTaskDefinition>>,
): ScriptContext<TData> {
  const state = { ...task.taskState };

  return {
    taskId: task.taskId,
    agentType: task.agentType,
    agentName: task.agentName,
    data,
    agents: {
      get(agentType, name) {
        return agents.get(agentType)?.get(name);
      },
      has(agentType, name) {
        return agents.get(agentType)?.has(name) ?? false;
      },
    },
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
