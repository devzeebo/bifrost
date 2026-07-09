import type {
  DataRegistry,
  WorkItem,
  WorkItemExecutionContext,
  WorkItemHandler,
} from "@bifrost-ai/interfaces-work";

import type { RpcClient } from "./rpc-client.js";
import type { Registry } from "./registry.js";
import { createRpcWorkItemSourceClient } from "./work-item-source-client.js";

export function createRpcWorkItemExecutionContext<TData extends Record<string, unknown>>(
  workItem: WorkItem,
  rpc: RpcClient,
  data: DataRegistry<TData>,
  handlers: Map<string, Registry<WorkItemHandler>>,
): { workItem: WorkItem; ctx: WorkItemExecutionContext<TData> } {
  const state = { ...workItem.state };

  const liveWorkItem: WorkItem = {
    workItemId: workItem.workItemId,
    kind: workItem.kind,
    name: workItem.name,
    metadata: workItem.metadata,
    state,
  };

  const ctx: WorkItemExecutionContext<TData> = {
    data,
    handlers: {
      get(kind, name) {
        return handlers.get(kind)?.get(name);
      },
      has(kind, name) {
        return handlers.get(kind)?.has(name) ?? false;
      },
    },
    source: createRpcWorkItemSourceClient(rpc),
    async setState(nextState) {
      Object.assign(state, nextState);
      await rpc.call("workItemSource.setState", {
        workItemId: workItem.workItemId,
        state,
      });
    },
  };

  return { workItem: liveWorkItem, ctx };
}
