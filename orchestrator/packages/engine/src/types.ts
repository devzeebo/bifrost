export type EngineContext = {
  taskId: string;
  workingDir: string;
  agentName: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
  setState: (newState: Record<string, unknown>) => Promise<void>;
  instructions?: string;
};

// FR-2: EngineResult MUST contain
export type EngineResult = {
  success: boolean;
  skipFulfill: boolean;
  lastMessage: string | null;
  stats: ExecutionStats | null;
  sessionId?: string;
};

// FR-2: ExecutionStats MUST contain
export type ExecutionStats = {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalCostUsd: number;
  numTurns: number;
};
