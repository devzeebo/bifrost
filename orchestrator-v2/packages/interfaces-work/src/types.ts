export type WorkItem = {
  workItemId: string;
  kind: string;
  name: string;
  state: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
};

export type WorkItemDependency = {
  workItemId: string;
  type: string;
};

export type CreateDraftWorkItemInput = {
  kind: string;
  name: string;
  state?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type WorkItemSource = {
  watchWorkItems: () => AsyncGenerator<WorkItem>;
  completeWorkItem: (workItemId: string) => Promise<void>;
  failWorkItem: (workItemId: string, error: string) => Promise<void>;
  pauseWorkItem: (workItemId: string) => Promise<void>;
  setState: (workItemId: string, state: Record<string, unknown>) => Promise<void>;
  createDraftWorkItem(input: CreateDraftWorkItemInput): Promise<string>;
  startWorkItem(workItemId: string): Promise<void>;
  setDependency(workItemId: string, dependsOnWorkItemId: string, type?: string): Promise<void>;
  getDependencies(workItemId: string): Promise<WorkItemDependency[]>;
};

const REQUIRED_WORK_ITEM_FIELDS = ["workItemId", "kind", "name"] as const;

export function isWorkItem(value: unknown): value is WorkItem {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<WorkItem>;
  if (
    typeof record.workItemId !== "string" ||
    record.workItemId.length === 0 ||
    typeof record.kind !== "string" ||
    record.kind.length === 0 ||
    typeof record.name !== "string" ||
    record.name.length === 0 ||
    record.state === null ||
    typeof record.state !== "object" ||
    record.metadata === null ||
    typeof record.metadata !== "object"
  ) {
    return false;
  }

  return true;
}

export function missingWorkItemFields(value: unknown): string[] {
  if (value === null || typeof value !== "object") {
    return [...REQUIRED_WORK_ITEM_FIELDS, "state", "metadata"];
  }

  const record = value as Record<string, unknown>;
  const missing: string[] = [];

  for (const field of REQUIRED_WORK_ITEM_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      missing.push(field);
    }
  }

  if (!(record.state !== null && typeof record.state === "object")) {
    missing.push("state");
  }
  if (!(record.metadata !== null && typeof record.metadata === "object")) {
    missing.push("metadata");
  }

  if (typeof record.workItemId === "string" && record.workItemId.length === 0) {
    missing.push("workItemId");
  }
  if (typeof record.name === "string" && record.name.length === 0) {
    missing.push("name");
  }
  if (typeof record.kind === "string" && record.kind.length === 0) {
    missing.push("kind");
  }

  return [...new Set(missing)];
}

export function missingWorkItemFieldsMessage(missing: string[]): string {
  return `Work item is missing required fields: ${missing.join(", ")}`;
}

export type ExecutionStats = {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalCostUsd: number;
  numTurns: number;
};

export type ReadonlyRegistry<T> = {
  get(name: string): T | undefined;
  has(name: string): boolean;
};

export type Registry<T> = ReadonlyRegistry<T> & {
  register(name: string, item: T): void;
};

export type DataRegistry<T extends Record<string, unknown>> = {
  get<K extends keyof T & string>(type: K): ReadonlyRegistry<T[K]>;
};

export type MutableDataRegistry<T extends Record<string, unknown>> = {
  get<K extends keyof T & string>(type: K): Registry<T[K]>;
  ensure<K extends keyof T & string>(
    type: K,
    guard: (value: unknown) => value is T[K],
  ): Registry<T[K]>;
};

export type WorkItemHandlerRegistry = {
  get(kind: string, name: string): WorkItemHandler | undefined;
  has(kind: string, name: string): boolean;
};

export type WorkItemExecutionContext<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly data: DataRegistry<TData>;
  readonly handlers: WorkItemHandlerRegistry;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

export type WorkItemResult = {
  outcome: "completed" | "failed" | "paused";
  message?: string;
  telemetry?: ExecutionStats;
};

export type WorkItemHandler<TData extends Record<string, unknown> = Record<string, unknown>> = {
  kind: string;
  name: string;
  run: (workItem: WorkItem, ctx: WorkItemExecutionContext<TData>) => Promise<WorkItemResult>;
};

export function isWorkItemHandler(value: unknown): value is WorkItemHandler {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<WorkItemHandler>;
  return (
    typeof record.kind === "string" &&
    typeof record.name === "string" &&
    typeof record.run === "function"
  );
}
