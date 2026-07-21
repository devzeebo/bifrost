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

export type WorkItemTreeNode = OpenWorkItem & {
  children: OpenWorkItem[];
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
      roots.push({
        ...item,
        children: childrenByParent.get(item.workItemId) ?? [],
      });
    }
  }

  roots.sort(compareByName);
  for (const root of roots) {
    root.children.sort(compareByName);
  }
  return roots;
}

function compareByName(a: OpenWorkItem, b: OpenWorkItem): number {
  return a.name.localeCompare(b.name);
}
