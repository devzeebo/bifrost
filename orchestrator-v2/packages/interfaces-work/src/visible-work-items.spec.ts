import { describe, expect, it } from "vite-plus/test";

import { selectVisibleWorkItems } from "./visible-work-items.js";

describe("selectVisibleWorkItems", () => {
  it("includes open parent and terminal children", () => {
    const result = selectVisibleWorkItems([
      {
        workItemId: "bf-7c45",
        kind: "workflow",
        name: "bdd-flow",
        status: "live",
      },
      {
        workItemId: "bf-7c45.39",
        kind: "task",
        name: "bdd-red",
        status: "completed",
        parentWorkItemId: "bf-7c45",
      },
      {
        workItemId: "bf-7c45.42",
        kind: "task",
        name: "ensure-story-complete",
        status: "failed",
        parentWorkItemId: "bf-7c45",
      },
    ]);

    expect(result.map((item) => item.workItemId).sort()).toEqual([
      "bf-7c45",
      "bf-7c45.39",
      "bf-7c45.42",
    ]);
  });

  it("excludes terminal orphan roots", () => {
    const result = selectVisibleWorkItems([
      {
        workItemId: "done-root",
        kind: "task",
        name: "done",
        status: "completed",
      },
      {
        workItemId: "solo",
        kind: "task",
        name: "solo",
        status: "live",
      },
    ]);

    expect(result.map((item) => item.workItemId)).toEqual(["solo"]);
  });
});
