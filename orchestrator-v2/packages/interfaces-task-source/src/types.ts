export type AgentType = string;

export type Task = {
  taskId: string;
  agentType: AgentType;
  agentName: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type ExecutionStats = {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalCostUsd: number;
  numTurns: number;
};

export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>;
  completeTask: (taskId: string, telemetry?: ExecutionStats) => Promise<void>;
  failTask: (taskId: string, error: string, telemetry?: ExecutionStats) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  setState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>;
};

const REQUIRED_TASK_FIELDS = ["taskId", "agentType", "agentName"] as const;

export function validateTask(value: unknown): value is Task {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<Task>;
  if (
    typeof record.taskId !== "string" ||
    record.taskId.length === 0 ||
    typeof record.agentType !== "string" ||
    record.agentType.length === 0 ||
    typeof record.agentName !== "string" ||
    record.agentName.length === 0 ||
    record.taskState === null ||
    typeof record.taskState !== "object" ||
    record.metadata === null ||
    typeof record.metadata !== "object"
  ) {
    return false;
  }

  return true;
}

export function missingTaskFields(value: unknown): string[] {
  if (value === null || typeof value !== "object") {
    return [...REQUIRED_TASK_FIELDS, "taskState", "metadata"];
  }

  const record = value as Record<string, unknown>;
  const missing: string[] = [];

  for (const field of REQUIRED_TASK_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      missing.push(field);
    }
  }

  if (!(record.taskState !== null && typeof record.taskState === "object")) {
    missing.push("taskState");
  }
  if (!(record.metadata !== null && typeof record.metadata === "object")) {
    missing.push("metadata");
  }

  if (typeof record.taskId === "string" && record.taskId.length === 0) {
    missing.push("taskId");
  }
  if (typeof record.agentName === "string" && record.agentName.length === 0) {
    missing.push("agentName");
  }
  if (typeof record.agentType === "string" && record.agentType.length === 0) {
    missing.push("agentType");
  }

  return [...new Set(missing)];
}

export function missingTaskFieldsMessage(missing: string[]): string {
  return `Task is missing required fields: ${missing.join(", ")}`;
}

const EXECUTION_STATS_FIELDS = [
  "durationMs",
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheCreationTokens",
  "totalCostUsd",
  "numTurns",
] as const;

export function isExecutionStats(value: unknown): value is ExecutionStats {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return EXECUTION_STATS_FIELDS.every((field) => typeof record[field] === "number");
}
