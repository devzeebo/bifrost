import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import {
  parentWorkItemIdFrom,
  workItemsHydrated,
  workItemsRemoved,
  workItemsUpserted,
} from "./actions.js";
import { isUiAction } from "./types.js";

type Context = {
  result: unknown;
};

describe("ui-events actions", () => {
  test("builds hydrate / upsert / remove actions", {
    when: {
      actions_are_created,
    },
    then: {
      actions_are_valid_ui_actions,
    },
  });

  test("reads parent from workflowWorkItemId first", {
    when: {
      parent_is_read_from_state_and_metadata,
    },
    then: {
      parent_comes_from_workflow_state,
    },
  });
});

function actions_are_created(this: Context) {
  this.result = [
    workItemsHydrated([
      {
        workItemId: "wf-1",
        kind: "workflow",
        name: "flow",
        status: "live",
      },
    ]),
    workItemsUpserted({
      workItemId: "child-1",
      kind: "task",
      name: "step",
      status: "draft",
      parentWorkItemId: "wf-1",
    }),
    workItemsRemoved("child-1"),
  ];
}

function actions_are_valid_ui_actions(this: Context) {
  const actions = this.result as unknown[];
  expect(actions.every((action) => isUiAction(action))).toBe(true);
}

function parent_is_read_from_state_and_metadata(this: Context) {
  this.result = parentWorkItemIdFrom(
    { workflowWorkItemId: "wf-from-state" },
    { parentId: "wf-from-meta" },
  );
}

function parent_comes_from_workflow_state(this: Context) {
  expect(this.result).toBe("wf-from-state");
}
