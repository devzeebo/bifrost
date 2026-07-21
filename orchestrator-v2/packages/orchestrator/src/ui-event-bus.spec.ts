import { describe, expect } from "vite-plus/test";
import test from "vitest-gwt";

import type { UiAction } from "@bifrost-ai/ui-events";

import { UiEventBus } from "./ui-event-bus.js";

type Context = {
  bus: UiEventBus;
  actions: UiAction[];
};

describe("UiEventBus", () => {
  test("upsert and remove update projection and notify listeners", {
    given: {
      a_bus_with_listener,
    },
    when: {
      workflow_child_lifecycle_is_emitted,
    },
    then: {
      actions_match_lifecycle,
      snapshot_only_has_paused_workflow,
    },
  });

  test("hydrateAction returns current open items", {
    given: {
      a_bus_with_items,
    },
    when: {
      hydrate_is_requested,
    },
    then: {
      hydrate_payload_matches_snapshot,
    },
  });

  test("markTerminal keeps child under open parent", {
    given: {
      a_bus_with_listener,
      workflow_with_live_child,
    },
    when: {
      child_is_marked_completed,
    },
    then: {
      child_remains_completed_under_parent,
    },
  });

  test("markTerminal removes completed root and its children", {
    given: {
      a_bus_with_listener,
      workflow_with_completed_child,
    },
    when: {
      workflow_is_marked_completed,
    },
    then: {
      workflow_and_children_are_removed,
    },
  });
});

function a_bus_with_listener(this: Context) {
  this.bus = new UiEventBus();
  this.actions = [];
  this.bus.subscribe((action) => {
    this.actions.push(action);
  });
}

function workflow_child_lifecycle_is_emitted(this: Context) {
  this.bus.upsert({
    workItemId: "wf-1",
    kind: "workflow",
    name: "flow",
    status: "live",
  });
  this.bus.upsert({
    workItemId: "child-1",
    kind: "task",
    name: "step",
    status: "draft",
    parentWorkItemId: "wf-1",
  });
  this.bus.updateStatus("child-1", "live");
  this.bus.updateStatus("wf-1", "paused");
  this.bus.remove("child-1");
}

function actions_match_lifecycle(this: Context) {
  expect(this.actions.map((action) => action.type)).toEqual([
    "workItems/upserted",
    "workItems/upserted",
    "workItems/upserted",
    "workItems/upserted",
    "workItems/removed",
  ]);
  expect(this.actions[2]).toMatchObject({
    type: "workItems/upserted",
    payload: { workItemId: "child-1", status: "live" },
  });
}

function snapshot_only_has_paused_workflow(this: Context) {
  expect(this.bus.snapshot()).toEqual([
    {
      workItemId: "wf-1",
      kind: "workflow",
      name: "flow",
      status: "paused",
    },
  ]);
}

function a_bus_with_items(this: Context) {
  this.bus = new UiEventBus();
  this.actions = [];
  this.bus.upsert({
    workItemId: "a",
    kind: "task",
    name: "alpha",
    status: "live",
  });
}

function hydrate_is_requested(this: Context) {
  this.actions = [this.bus.hydrateAction()];
}

function hydrate_payload_matches_snapshot(this: Context) {
  expect(this.actions[0]).toEqual({
    type: "workItems/hydrated",
    payload: {
      items: [
        {
          workItemId: "a",
          kind: "task",
          name: "alpha",
          status: "live",
        },
      ],
    },
  });
}

function workflow_with_live_child(this: Context) {
  this.bus.upsert({
    workItemId: "wf-1",
    kind: "workflow",
    name: "flow",
    status: "live",
  });
  this.bus.upsert({
    workItemId: "child-1",
    kind: "task",
    name: "step",
    status: "live",
    parentWorkItemId: "wf-1",
  });
  this.actions = [];
}

function child_is_marked_completed(this: Context) {
  this.bus.markTerminal("child-1", "completed");
}

function child_remains_completed_under_parent(this: Context) {
  expect(this.bus.get("child-1")).toMatchObject({ status: "completed", parentWorkItemId: "wf-1" });
  expect(this.bus.get("wf-1")?.status).toBe("live");
  expect(this.actions).toEqual([
    {
      type: "workItems/upserted",
      payload: {
        workItemId: "child-1",
        kind: "task",
        name: "step",
        status: "completed",
        parentWorkItemId: "wf-1",
      },
    },
  ]);
}

function workflow_with_completed_child(this: Context) {
  this.bus.upsert({
    workItemId: "wf-1",
    kind: "workflow",
    name: "flow",
    status: "live",
  });
  this.bus.upsert({
    workItemId: "child-1",
    kind: "task",
    name: "step",
    status: "completed",
    parentWorkItemId: "wf-1",
  });
  this.actions = [];
}

function workflow_is_marked_completed(this: Context) {
  this.bus.markTerminal("wf-1", "completed");
}

function workflow_and_children_are_removed(this: Context) {
  expect(this.bus.snapshot()).toEqual([]);
  expect(this.actions.map((action) => action.type)).toEqual([
    "workItems/upserted",
    "workItems/removed",
    "workItems/removed",
  ]);
}
