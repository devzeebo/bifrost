export type Template = {
  parameters: Record<string, unknown>;
};

export type AgentTool =
  | string
  | {
      name: string;
      allow?: string[];
      deny?: string[];
    };

export type AgentDefinition = {
  name: string;
  description: string;
  tools: AgentTool[];
  template: Template;
  promptBody: string;
  model?: string;
};

export type EngineContext = {
  workItemId: string;
  workingDir: string;
  agent: AgentDefinition;
  state: Record<string, unknown>;
  metadata: Record<string, unknown>;
  setState: (newState: Record<string, unknown>) => Promise<void>;
  instructions: string;
};

export type EngineResult = {
  success: boolean;
  skipFulfill: boolean;
  lastMessage: string | null;
  stats: ExecutionStats | null;
  sessionId?: string;
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
