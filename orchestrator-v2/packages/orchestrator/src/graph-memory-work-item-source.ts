import type {
  CreateDraftWorkItemInput,
  WorkItem,
  WorkItemDependency,
  WorkItemSource,
  WorkItemStatus,
} from "@bifrost-ai/interfaces-work";

const POLL_MS = 10;

export type GraphMemoryWorkItemSource = WorkItemSource & {
  completed: string[];
  failed: Array<{ workItemId: string; error: string }>;
  paused: string[];
  states: Map<string, Record<string, unknown>>;
  drafts: Map<string, CreateDraftWorkItemInput>;
  started: Set<string>;
  dependencies: Map<string, WorkItemDependency[]>;
  items: Map<string, WorkItem>;
  statuses: Map<string, WorkItemStatus>;
  startedOrder: string[];
  abort(): void;
};

export function createGraphMemoryWorkItemSource(
  initialWorkItems: WorkItem[] = [],
): GraphMemoryWorkItemSource {
  const completed: string[] = [];
  const failed: Array<{ workItemId: string; error: string }> = [];
  const paused: string[] = [];
  const states = new Map<string, Record<string, unknown>>();
  const drafts = new Map<string, CreateDraftWorkItemInput>();
  const started = new Set<string>();
  const dependencies = new Map<string, WorkItemDependency[]>();
  const items = new Map<string, WorkItem>();
  const statuses = new Map<string, WorkItemStatus>();
  const startedOrder: string[] = [];
  const queued = new Set<string>();
  const readyQueue: WorkItem[] = [];
  let nextDraftId = 1;
  let aborted = false;

  for (const workItem of initialWorkItems) {
    registerItem(workItem, "live");
    started.add(workItem.workItemId);
  }

  function registerItem(workItem: WorkItem, status: WorkItemStatus): void {
    items.set(workItem.workItemId, {
      workItemId: workItem.workItemId,
      kind: workItem.kind,
      name: workItem.name,
      flow: [...workItem.flow],
      state: { ...workItem.state },
      metadata: { ...workItem.metadata },
    });
    statuses.set(workItem.workItemId, status);
    states.set(workItem.workItemId, { ...workItem.state });
  }

  function getStatus(workItemId: string): WorkItemStatus {
    return statuses.get(workItemId) ?? "draft";
  }

  function isTerminal(status: WorkItemStatus): boolean {
    return status === "completed" || status === "failed";
  }

  function depsSatisfied(workItemId: string): boolean {
    const deps = dependencies.get(workItemId) ?? [];
    return deps.every((dep) => isTerminal(getStatus(dep.workItemId)));
  }

  function isRunnable(workItemId: string): boolean {
    const status = getStatus(workItemId);
    if (status !== "live") {
      return false;
    }
    return depsSatisfied(workItemId);
  }

  function enqueueIfReady(workItemId: string): void {
    if (!isRunnable(workItemId) || queued.has(workItemId)) {
      return;
    }
    const item = items.get(workItemId);
    if (item === undefined) {
      return;
    }
    queued.add(workItemId);
    readyQueue.push({
      ...item,
      state: { ...(states.get(workItemId) ?? item.state) },
    });
  }

  function scanForReady(): void {
    for (const workItemId of items.keys()) {
      enqueueIfReady(workItemId);
    }
  }

  function reevaluatePaused(): void {
    for (const [workItemId, status] of statuses) {
      if (status === "paused" && depsSatisfied(workItemId)) {
        statuses.set(workItemId, "live");
        queued.delete(workItemId);
        enqueueIfReady(workItemId);
      }
    }
  }

  function onTerminal(workItemId: string): void {
    queued.delete(workItemId);
    reevaluatePaused();
    scanForReady();
  }

  for (const workItem of initialWorkItems) {
    enqueueIfReady(workItem.workItemId);
  }

  const source: GraphMemoryWorkItemSource = {
    completed,
    failed,
    paused,
    states,
    drafts,
    started,
    dependencies,
    items,
    statuses,
    startedOrder,
    async *watchWorkItems() {
      while (!aborted) {
        scanForReady();
        while (readyQueue.length > 0) {
          const workItem = readyQueue.shift();
          if (workItem === undefined) {
            break;
          }
          yield workItem;
        }
        await delay(POLL_MS);
      }
    },
    async completeWorkItem(workItemId: string) {
      completed.push(workItemId);
      statuses.set(workItemId, "completed");
      onTerminal(workItemId);
    },
    async failWorkItem(workItemId: string, error: string) {
      failed.push({ workItemId, error });
      statuses.set(workItemId, "failed");
      onTerminal(workItemId);
    },
    async pauseWorkItem(workItemId: string) {
      paused.push(workItemId);
      statuses.set(workItemId, "paused");
      queued.delete(workItemId);
      const queuedIndex = readyQueue.findIndex((item) => item.workItemId === workItemId);
      if (queuedIndex >= 0) {
        readyQueue.splice(queuedIndex, 1);
      }
    },
    async setState(workItemId: string, state: Record<string, unknown>) {
      states.set(workItemId, state);
      const item = items.get(workItemId);
      if (item !== undefined) {
        items.set(workItemId, { ...item, state: { ...state } });
      }
    },
    async createDraftWorkItem(input: CreateDraftWorkItemInput) {
      const workItemId = `draft-${nextDraftId}`;
      nextDraftId += 1;
      drafts.set(workItemId, input);
      registerItem(
        {
          workItemId,
          kind: input.kind,
          name: input.name,
          flow: [...(input.flow ?? [])],
          state: input.state ?? {},
          metadata: input.metadata ?? {},
        },
        "draft",
      );
      return workItemId;
    },
    async startWorkItem(workItemId: string) {
      started.add(workItemId);
      startedOrder.push(workItemId);
      statuses.set(workItemId, "live");
      enqueueIfReady(workItemId);
    },
    async setDependency(workItemId: string, dependsOnWorkItemId: string, type = "blocks") {
      const edges = dependencies.get(workItemId) ?? [];
      edges.push({ workItemId: dependsOnWorkItemId, type });
      dependencies.set(workItemId, edges);
    },
    async getDependencies(workItemId: string) {
      return dependencies.get(workItemId) ?? [];
    },
    async getWorkItemStatus(workItemId: string) {
      return getStatus(workItemId);
    },
    abort() {
      aborted = true;
    },
  };

  return source;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
