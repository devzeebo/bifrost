import type { ExecutionStats } from "@bifrost-ai/engine";
import type { SessionStats } from "@earendil-works/pi-coding-agent";

export const mapSessionStats = (
  stats: SessionStats,
  durationMs: number,
  numTurns: number,
): ExecutionStats => ({
  durationMs,
  inputTokens: stats.tokens.input,
  outputTokens: stats.tokens.output,
  cacheReadTokens: stats.tokens.cacheRead,
  cacheCreationTokens: stats.tokens.cacheWrite,
  totalCostUsd: stats.cost,
  numTurns,
});
