/**
 * Metrics handling for ATIF conversion
 * Extracts and aggregates LLM usage metrics
 */

import type { UsageStats } from "./types.js";
import type { MetricsSchema, FinalMetricsSchema, StepObject } from "@atif/core";

/**
 * Extract metrics from JSONL usage stats
 */
export const extractMetrics = (usage: UsageStats): MetricsSchema | undefined => {
  if (!usage) {
    return undefined;
  }

  const metrics: MetricsSchema = {
    prompt_tokens: usage.input_tokens,
    completion_tokens: usage.output_tokens,
    cached_tokens: usage.cache_read_input_tokens,
    extra: {},
  };

  // Add cache creation tokens if present
  if (usage.cache_creation_input_tokens) {
    (metrics.extra as Record<string, unknown>).cache_creation_input_tokens =
      usage.cache_creation_input_tokens;
  }

  // Add server tool use stats if present
  if (usage.server_tool_use) {
    (metrics.extra as Record<string, unknown>).server_tool_use = usage.server_tool_use;
  }

  return metrics;
};

/**
 * Aggregate metrics across all steps
 */
export const aggregateMetrics = (steps: StepObject[]): FinalMetricsSchema | undefined => {
  if (steps.length === 0) {
    return undefined;
  }

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCachedTokens = 0;

  for (const step of steps) {
    if (step.metrics) {
      totalPromptTokens += step.metrics.prompt_tokens || 0;
      totalCompletionTokens += step.metrics.completion_tokens || 0;
      totalCachedTokens += step.metrics.cached_tokens || 0;
    }
  }

  const finalMetrics: FinalMetricsSchema = {
    total_prompt_tokens: totalPromptTokens,
    total_completion_tokens: totalCompletionTokens,
    total_cached_tokens: totalCachedTokens,
    total_steps: steps.length,
    extra: {},
  };

  return finalMetrics;
};

/**
 * Calculate cost from tokens (placeholder for actual pricing logic)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const calculateCost = (
  _promptTokens: number,
  _completionTokens: number,
  _cachedTokens: number,
): number =>
  // This is a placeholder - actual pricing would depend on:
  // - Model type
  // - Provider (Anthropic, OpenAI, etc.)
  // - Pricing tier
  // - Region
  //
  // For now, return 0 to avoid inaccurate cost calculations
  0;
