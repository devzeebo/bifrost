// FR-2: EngineContext MUST contain
export type EngineContext = {
  taskId: string
  workingDir: string
  agentName: string
  verbose: boolean
}

// FR-2: EngineResult MUST contain
export type EngineResult = {
  success: boolean
  skipFulfill: boolean
  lastMessage: string | null
  stats: ExecutionStats | null
}

// FR-2: ExecutionStats MUST contain
export type ExecutionStats = {
  durationMs: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalCostUsd: number
  numTurns: number
}
