import type { OpenWorkItem, UiAction } from "@bifrost-ai/ui-events";
import { createSlice } from "@reduxjs/toolkit";

export type WorkItemsState = {
  byId: Record<string, OpenWorkItem>;
};

const initialState: WorkItemsState = {
  byId: {},
};

const workItemsSlice = createSlice({
  name: "workItems",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addMatcher(
      (action): action is Extract<UiAction, { type: "workItems/hydrated" }> =>
        action.type === "workItems/hydrated",
      (state, action) => {
        state.byId = {};
        for (const item of action.payload.items) {
          state.byId[item.workItemId] = item;
        }
      },
    );
    builder.addMatcher(
      (action): action is Extract<UiAction, { type: "workItems/upserted" }> =>
        action.type === "workItems/upserted",
      (state, action) => {
        state.byId[action.payload.workItemId] = action.payload;
      },
    );
    builder.addMatcher(
      (action): action is Extract<UiAction, { type: "workItems/removed" }> =>
        action.type === "workItems/removed",
      (state, action) => {
        delete state.byId[action.payload.workItemId];
      },
    );
  },
});

export const workItemsReducer = workItemsSlice.reducer;

export type WorkItemChildNode = OpenWorkItem & {
  depDepth: number;
};

export type WorkItemTreeNode = OpenWorkItem & {
  children: WorkItemChildNode[];
};

export function selectWorkItemTree(state: { workItems: WorkItemsState }): WorkItemTreeNode[] {
  const items = Object.values(state.workItems.byId);
  const byId = state.workItems.byId;

  const childrenByParent = new Map<string, OpenWorkItem[]>();
  for (const item of items) {
    if (item.parentWorkItemId === undefined) {
      continue;
    }
    const siblings = childrenByParent.get(item.parentWorkItemId) ?? [];
    siblings.push(item);
    childrenByParent.set(item.parentWorkItemId, siblings);
  }

  const roots: WorkItemTreeNode[] = [];
  for (const item of items) {
    const parentMissing =
      item.parentWorkItemId !== undefined && byId[item.parentWorkItemId] === undefined;
    if (item.parentWorkItemId === undefined || parentMissing) {
      const rawChildren = childrenByParent.get(item.workItemId) ?? [];
      roots.push({
        ...item,
        children: orderChildrenByDependency(rawChildren),
      });
    }
  }

  roots.sort(compareByName);
  return roots;
}

/** Topological order among siblings; depDepth = longest blocker path within the set. */
export function orderChildrenByDependency(children: OpenWorkItem[]): WorkItemChildNode[] {
  if (children.length === 0) {
    return [];
  }

  const siblingIds = new Set(children.map((child) => child.workItemId));
  const byId = new Map(children.map((child) => [child.workItemId, child]));
  const blockers = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const child of children) {
    const deps = (child.blockedByWorkItemIds ?? []).filter((id) => siblingIds.has(id));
    blockers.set(child.workItemId, deps);
    indegree.set(child.workItemId, deps.length);
    for (const depId of deps) {
      const list = dependents.get(depId) ?? [];
      list.push(child.workItemId);
      dependents.set(depId, list);
    }
  }

  const depth = new Map<string, number>();
  const ready = children
    .filter((child) => (indegree.get(child.workItemId) ?? 0) === 0)
    .sort(compareByName)
    .map((child) => child.workItemId);

  for (const id of ready) {
    depth.set(id, 0);
  }

  const ordered: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) {
      break;
    }
    ordered.push(id);
    const currentDepth = depth.get(id) ?? 0;

    const nextIds = (dependents.get(id) ?? []).sort((a, b) =>
      compareByName(byId.get(a)!, byId.get(b)!),
    );
    for (const nextId of nextIds) {
      depth.set(nextId, Math.max(depth.get(nextId) ?? 0, currentDepth + 1));
      const nextDegree = (indegree.get(nextId) ?? 0) - 1;
      indegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        ready.push(nextId);
        ready.sort((a, b) => compareByName(byId.get(a)!, byId.get(b)!));
      }
    }
  }

  if (ordered.length < children.length) {
    const seen = new Set(ordered);
    const rest = children.filter((child) => !seen.has(child.workItemId)).sort(compareByName);
    for (const child of rest) {
      ordered.push(child.workItemId);
      if (!depth.has(child.workItemId)) {
        depth.set(child.workItemId, 0);
      }
    }
  }

  return ordered.map((id) => {
    const item = byId.get(id)!;
    return {
      ...item,
      depDepth: depth.get(id) ?? 0,
    };
  });
}

function compareByName(a: OpenWorkItem, b: OpenWorkItem): number {
  return a.name.localeCompare(b.name);
}
