import { describe, expect, it } from "vite-plus/test";

import { calculateUsageCostUsd, resolveModelRates } from "./pricing.js";
import { mapRunResultToStats } from "./stats.js";

describe("pricing", () => {
  it("resolves composer-2.5 rates from catalog", () => {
    expect(resolveModelRates("composer-2.5")).toEqual({
      input: 0.5,
      cacheRead: 0.2,
      output: 2.5,
    });
  });

  it("resolves auto pool rates", () => {
    expect(resolveModelRates("auto")).toEqual({
      input: 1.25,
      cacheWrite: 1.25,
      cacheRead: 0.25,
      output: 6,
    });
  });

  it("returns undefined for unknown models", () => {
    expect(resolveModelRates("unknown-model-xyz")).toBeUndefined();
  });

  it("prefers the longest matching catalog prefix", () => {
    expect(resolveModelRates("gpt-5-fast-preview")).toEqual({
      input: 2.5,
      cacheRead: 0.25,
      output: 20,
    });
  });

  it("calculates composer-2.5 cost from token usage", () => {
    const cost = calculateUsageCostUsd("composer-2.5", {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 200_000,
      cacheWriteTokens: 0,
    });

    // 1M * $0.5 + 0.5M * $2.5 + 0.2M * $0.2 = $0.5 + $1.25 + $0.04 = $1.79
    expect(cost).toBeCloseTo(1.79, 5);
  });

  it("uses input rate for cache write when cache write price is absent", () => {
    const cost = calculateUsageCostUsd("composer-2.5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 1_000_000,
    });

    expect(cost).toBeCloseTo(0.5, 5);
  });

  it("calculates anthropic model cost with separate cache write pricing", () => {
    const cost = calculateUsageCostUsd("claude-4-5-sonnet", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });

    // $3 + $15 + $0.3 + $3.75 = $22.05
    expect(cost).toBeCloseTo(22.05, 5);
  });

  it("returns zero cost for unknown models", () => {
    expect(
      calculateUsageCostUsd("does-not-exist", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBe(0);
  });
});

describe("mapRunResultToStats", () => {
  it("includes calculated totalCostUsd from model pricing", () => {
    const stats = mapRunResultToStats(
      {
        durationMs: 500,
        modelId: "composer-2.5",
        usage: {
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 100,
          cacheWriteTokens: 0,
          totalTokens: 1600,
        },
      },
      2,
    );

    expect(stats.totalCostUsd).toBeGreaterThan(0);
    expect(stats.numTurns).toBe(2);
    expect(stats.cacheCreationTokens).toBe(0);
  });
});
