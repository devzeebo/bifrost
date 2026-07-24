import type { OpenWorkItem } from "@bifrost-ai/ui-events";
import { workItemsHydrated } from "@bifrost-ai/ui-events";

import type { AppStore } from "./store.js";

/** Dev escape hatch: seed the store without a live orchestrator. */
export function dispatchFixtureWorkItems(store: AppStore): void {
  const fixtures: OpenWorkItem[] = [
    {
      workItemId: "bf-7c45",
      kind: "workflow",
      name: "bdd-flow",
      status: "in_progress",
    },
    {
      workItemId: "bf-7c45.39",
      kind: "task",
      name: "bdd-red",
      status: "completed",
      parentWorkItemId: "bf-7c45",
    },
    {
      workItemId: "bf-7c45.41",
      kind: "task",
      name: "bdd-green",
      status: "completed",
      parentWorkItemId: "bf-7c45",
      blockedByWorkItemIds: ["bf-7c45.39"],
    },
    {
      workItemId: "bf-7c45.40",
      kind: "task",
      name: "bdd-refactor",
      status: "completed",
      parentWorkItemId: "bf-7c45",
      blockedByWorkItemIds: ["bf-7c45.41"],
    },
    {
      workItemId: "bf-7c45.42",
      kind: "task",
      name: "ensure-story-complete",
      status: "failed",
      parentWorkItemId: "bf-7c45",
      blockedByWorkItemIds: ["bf-7c45.40"],
    },
  ];

  store.dispatch(workItemsHydrated(fixtures));
}
