export type ExecutionStats = {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalCostUsd: number;
  numTurns: number;
};

export type ScriptContext = {
  taskState: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

export type ScriptResult = {
  outcome: "completed" | "failed" | "paused";
  message?: string;
  telemetry?: ExecutionStats;
};

export type ScriptTaskDefinition = {
  name: string;
  run: (ctx: ScriptContext) => Promise<ScriptResult>;
};
