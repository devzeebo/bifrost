import type {
  OpenWorkItem,
  WorkItemsHydrated,
  WorkItemsRemoved,
  WorkItemsUpserted,
} from "./types.js";

export function workItemsHydrated(items: OpenWorkItem[]): WorkItemsHydrated {
  return {
    type: "workItems/hydrated",
    payload: { items },
  };
}

export function workItemsUpserted(item: OpenWorkItem): WorkItemsUpserted {
  return {
    type: "workItems/upserted",
    payload: item,
  };
}

export function workItemsRemoved(workItemId: string): WorkItemsRemoved {
  console.log("removed");
  return {
    type: "workItems/removed",
    payload: { workItemId },
  };
}

export function parentWorkItemIdFrom(
  state: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  if (state !== undefined && typeof state.workflowWorkItemId === "string") {
    return state.workflowWorkItemId;
  }
  if (metadata !== undefined && typeof metadata.parentId === "string") {
    return metadata.parentId;
  }
  return undefined;
}
