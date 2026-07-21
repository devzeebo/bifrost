export type OpenWorkItemStatus = "draft" | "live" | "paused" | "completed" | "failed";

export type OpenWorkItem = {
  workItemId: string;
  kind: string;
  name: string;
  status: OpenWorkItemStatus;
  parentWorkItemId?: string;
};

export type WorkItemsHydrated = {
  type: "workItems/hydrated";
  payload: {
    items: OpenWorkItem[];
  };
};

export type WorkItemsUpserted = {
  type: "workItems/upserted";
  payload: OpenWorkItem;
};

export type WorkItemsRemoved = {
  type: "workItems/removed";
  payload: {
    workItemId: string;
  };
};

export type UiAction = WorkItemsHydrated | WorkItemsUpserted | WorkItemsRemoved;

export const OPEN_WORK_ITEM_STATUSES = ["draft", "live", "paused", "completed", "failed"] as const;

export const NON_TERMINAL_WORK_ITEM_STATUSES = ["draft", "live", "paused"] as const;

export function isOpenWorkItemStatus(status: string): status is OpenWorkItemStatus {
  return (OPEN_WORK_ITEM_STATUSES as readonly string[]).includes(status);
}

export function isNonTerminalOpenWorkItemStatus(
  status: OpenWorkItemStatus,
): status is "draft" | "live" | "paused" {
  return (NON_TERMINAL_WORK_ITEM_STATUSES as readonly string[]).includes(status);
}

export function isUiAction(value: unknown): value is UiAction {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as { type?: unknown; payload?: unknown };
  if (typeof record.type !== "string") {
    return false;
  }

  switch (record.type) {
    case "workItems/hydrated":
      return isHydratedPayload(record.payload);
    case "workItems/upserted":
      return isOpenWorkItem(record.payload);
    case "workItems/removed":
      return isRemovedPayload(record.payload);
    default:
      return false;
  }
}

export function isOpenWorkItem(value: unknown): value is OpenWorkItem {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<OpenWorkItem>;
  if (
    typeof record.workItemId !== "string" ||
    record.workItemId.length === 0 ||
    typeof record.kind !== "string" ||
    record.kind.length === 0 ||
    typeof record.name !== "string" ||
    record.name.length === 0 ||
    typeof record.status !== "string" ||
    !isOpenWorkItemStatus(record.status)
  ) {
    return false;
  }

  if (record.parentWorkItemId !== undefined && typeof record.parentWorkItemId !== "string") {
    return false;
  }

  return true;
}

function isHydratedPayload(value: unknown): value is WorkItemsHydrated["payload"] {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as { items?: unknown };
  return Array.isArray(record.items) && record.items.every((item) => isOpenWorkItem(item));
}

function isRemovedPayload(value: unknown): value is WorkItemsRemoved["payload"] {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as { workItemId?: unknown };
  return typeof record.workItemId === "string" && record.workItemId.length > 0;
}
