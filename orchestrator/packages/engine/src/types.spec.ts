import { describe, expect, it, vi } from "vitest";
import type { EngineContext, EngineResult, ExecutionStats } from "./types";

describe("Engine Types", () => {
  describe("ExecutionStats", () => {
    it("should contain all required telemetry fields", () => {
      // FR-2: ExecutionStats MUST contain
      const stats: ExecutionStats = {
        durationMs: 5000,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheCreationTokens: 50,
        totalCostUsd: 0.05,
        numTurns: 3,
      };

      expect(stats.durationMs).toBe(5000);
      expect(stats.inputTokens).toBe(1000);
      expect(stats.outputTokens).toBe(500);
      expect(stats.cacheReadTokens).toBe(100);
      expect(stats.cacheCreationTokens).toBe(50);
      expect(stats.totalCostUsd).toBe(0.05);
      expect(stats.numTurns).toBe(3);
    });
  });

  describe("EngineResult", () => {
    it("should contain success, skipFulfill, lastMessage, and stats", () => {
      // FR-2: EngineResult MUST contain
      const result: EngineResult = {
        success: true,
        skipFulfill: false,
        lastMessage: "Task completed",
        stats: {
          durationMs: 5000,
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalCostUsd: 0.03,
          numTurns: 1,
        },
      };

      expect(result.success).toBe(true);
      expect(result.skipFulfill).toBe(false);
      expect(result.lastMessage).toBe("Task completed");
      expect(result.stats).toBeDefined();
    });

    it("should allow null stats and lastMessage", () => {
      const result: EngineResult = {
        success: false,
        skipFulfill: false,
        lastMessage: null,
        stats: null,
      };

      expect(result.success).toBe(false);
      expect(result.lastMessage).toBeNull();
      expect(result.stats).toBeNull();
    });
  });

  describe("EngineContext", () => {
    it("should contain taskId, workingDir, agent, taskState, metadata, and setState", () => {
      const context: EngineContext = {
        taskId: "task-123",
        workingDir: "/home/user/project",
        agent: {
          name: "reviewer",
          description: "Code review agent",
          tools: [],
          toolClasses: [],
          template: { parameters: {} },
          promptBody: "Review the code.",
        },
        taskState: { step: 1 },
        metadata: { priority: "high" },
        setState: vi.fn().mockResolvedValue(null),
      };

      expect(context.taskId).toBe("task-123");
      expect(context.workingDir).toBe("/home/user/project");
      expect(context.agent.name).toBe("reviewer");
      expect(context.taskState).toEqual({ step: 1 });
      expect(context.metadata).toEqual({ priority: "high" });
      expect(context.setState).toBeDefined();
    });
  });
});
