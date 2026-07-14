import type { DataRegistry, ScriptContext, WorkItem } from "@bifrost-ai/interfaces-work";

import type { RpcClient } from "./rpc-client.js";
import { createRpcWorkItemSourceClient } from "./work-item-source-client.js";

export function resolveScriptCwd(workItem: WorkItem): string {
  return typeof workItem.state.workingDir === "string" && workItem.state.workingDir.length > 0
    ? workItem.state.workingDir
    : process.cwd();
}

export function createLiveWorkItem(workItem: WorkItem): WorkItem {
  return {
    workItemId: workItem.workItemId,
    kind: workItem.kind,
    name: workItem.name,
    flow: [...workItem.flow],
    metadata: workItem.metadata,
    state: { ...workItem.state },
  };
}

export function createScriptContext<TData extends Record<string, unknown>>(
  workItem: WorkItem,
  rpc: RpcClient,
  data: DataRegistry<TData>,
): { workItem: WorkItem; ctx: ScriptContext<TData> } {
  const liveWorkItem = createLiveWorkItem(workItem);

  const ctx: ScriptContext<TData> = {
    cwd: resolveScriptCwd(liveWorkItem),
    data,
    workItemSource: createRpcWorkItemSourceClient(rpc),
    async setState(nextState) {
      const mergedState = { ...liveWorkItem.state, ...nextState };
      await rpc.call("workItemSource.setState", {
        workItemId: workItem.workItemId,
        state: mergedState,
      });
      Object.assign(liveWorkItem.state, nextState);
    },
  };

  return { workItem: liveWorkItem, ctx };
}
