import type { OpenWorkItem } from "@bifrost-ai/ui-events";
import { workItemsHydrated } from "@bifrost-ai/ui-events";

import type { AppStore } from "./store.js";

/** Dev escape hatch: seed the store without a live orchestrator. */
export function dispatchFixtureWorkItems(store: AppStore): void {
  const fixtures: OpenWorkItem[] = [
    {
      workItemId: "wf-demo",
      kind: "workflow",
      name: "cowsay-flow",
      status: "paused",
    },
    {
      workItemId: "task-say",
      kind: "script",
      name: "cowsay",
      status: "completed",
      parentWorkItemId: "wf-demo",
    },
    {
      workItemId: "task-summarize",
      kind: "task",
      name: "summarize",
      status: "failed",
      parentWorkItemId: "wf-demo",
    },
    {
      workItemId: "solo-task",
      kind: "task",
      name: "standalone-review",
      status: "live",
    },
  ];

  store.dispatch(workItemsHydrated(fixtures));
}
