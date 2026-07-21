import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";
import { workItemsHydrated, workItemsRemoved, workItemsUpserted } from "@bifrost-ai/ui-events";

import { createAppStore, type AppStore } from "./store.js";
import { selectWorkItemTree } from "./workItemsSlice.js";

type Context = {
  store: AppStore;
  tree: ReturnType<typeof selectWorkItemTree>;
};

describe("workItems projection", () => {
  test("hydrates upserts and removes open items", {
    given: {
      an_empty_store,
    },
    when: {
      hydrate_upsert_and_remove_are_dispatched,
    },
    then: {
      store_reflects_open_set,
    },
  });

  test("groups children under workflow parents", {
    given: {
      a_store_with_workflow_tree,
    },
    when: {
      tree_is_selected,
    },
    then: {
      children_nest_under_workflow,
    },
  });

  test("orphaned children appear as roots", {
    given: {
      a_store_with_orphan_child,
    },
    when: {
      tree_is_selected,
    },
    then: {
      orphan_appears_as_root,
    },
  });
});

function an_empty_store(this: Context) {
  this.store = createAppStore();
}

function hydrate_upsert_and_remove_are_dispatched(this: Context) {
  this.store.dispatch(
    workItemsHydrated([
      {
        workItemId: "wf-1",
        kind: "workflow",
        name: "flow",
        status: "live",
      },
    ]),
  );
  this.store.dispatch(
    workItemsUpserted({
      workItemId: "child-1",
      kind: "task",
      name: "step",
      status: "draft",
      parentWorkItemId: "wf-1",
    }),
  );
  this.store.dispatch(workItemsRemoved("child-1"));
}

function store_reflects_open_set(this: Context) {
  expect(Object.keys(this.store.getState().workItems.byId)).toEqual(["wf-1"]);
}

function a_store_with_workflow_tree(this: Context) {
  this.store = createAppStore();
  this.store.dispatch(
    workItemsHydrated([
      {
        workItemId: "wf-1",
        kind: "workflow",
        name: "flow",
        status: "paused",
      },
      {
        workItemId: "b",
        kind: "task",
        name: "beta",
        status: "live",
        parentWorkItemId: "wf-1",
      },
      {
        workItemId: "a",
        kind: "task",
        name: "alpha",
        status: "draft",
        parentWorkItemId: "wf-1",
      },
      {
        workItemId: "solo",
        kind: "task",
        name: "solo",
        status: "live",
      },
    ]),
  );
}

function tree_is_selected(this: Context) {
  this.tree = selectWorkItemTree(this.store.getState());
}

function children_nest_under_workflow(this: Context) {
  const workflow = this.tree.find((node) => node.workItemId === "wf-1");
  expect(workflow?.children.map((child) => child.name)).toEqual(["alpha", "beta"]);
  expect(this.tree.some((node) => node.workItemId === "solo")).toBe(true);
  expect(this.tree.some((node) => node.workItemId === "a")).toBe(false);
}

function a_store_with_orphan_child(this: Context) {
  this.store = createAppStore();
  this.store.dispatch(
    workItemsHydrated([
      {
        workItemId: "orphan",
        kind: "task",
        name: "orphan",
        status: "live",
        parentWorkItemId: "missing-parent",
      },
    ]),
  );
}

function orphan_appears_as_root(this: Context) {
  expect(this.tree).toHaveLength(1);
  expect(this.tree[0]?.workItemId).toBe("orphan");
}
