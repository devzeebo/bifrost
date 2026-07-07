import type { ExecutionStats } from "@bifrost-ai/engine";

import { calculateUsageCostUsd, type TokenUsage } from "./pricing.js";

type RunStatsInput = {
  durationMs?: number;
  usage?: TokenUsage & { totalTokens?: number; reasoningTokens?: number };
  modelId?: string;
};

export const mapRunResultToStats = (result: RunStatsInput, numTurns: number): ExecutionStats => {
  const usage = result.usage;
  const tokenUsage: TokenUsage = {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
  };

  return {
    durationMs: result.durationMs ?? 0,
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    cacheReadTokens: tokenUsage.cacheReadTokens,
    cacheCreationTokens: tokenUsage.cacheWriteTokens,
    totalCostUsd: calculateUsageCostUsd(result.modelId, tokenUsage),
    numTurns,
  };
};
