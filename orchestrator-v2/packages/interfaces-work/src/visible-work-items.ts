import type { WorkItemListing, WorkItemStatus } from "./types.js";

export function isNonTerminalWorkItemStatus(status: WorkItemStatus): boolean {
  return status === "draft" || status === "live" || status === "paused";
}

/**
 * Visible set = every non-terminal item, plus every descendant of those items
 * (including fulfilled/failed children).
 */
export function selectVisibleWorkItems(all: WorkItemListing[]): WorkItemListing[] {
  const visible = new Set<string>();

  for (const item of all) {
    if (isNonTerminalWorkItemStatus(item.status)) {
      visible.add(item.workItemId);
    }
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const item of all) {
      if (visible.has(item.workItemId)) {
        continue;
      }
      if (item.parentWorkItemId !== undefined && visible.has(item.parentWorkItemId)) {
        visible.add(item.workItemId);
        grew = true;
      }
    }
  }

  return all.filter((item) => visible.has(item.workItemId));
}
