import { describe, it, expect, vi } from "vitest";
import { TestEngine } from "./test-engine.js";
import type { EngineContext } from "./types.js";

describe("Test Engine", () => {
  describe("Basic execution", () => {
    it("should execute and return success result", async () => {
      const engine = new TestEngine();

      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test/project",
        agentName: "test-agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };

      const result = await engine.execute(context);

      expect(result.success).toBe(true);
      expect(result.lastMessage).toContain("complete");
      expect(result.stats).toBeDefined();
      expect(result.stats?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should include execution telemetry", async () => {
      const engine = new TestEngine();

      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agentName: "agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };

      const result = await engine.execute(context);

      expect(result.stats).toMatchObject({
        durationMs: expect.any(Number),
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        cacheReadTokens: expect.any(Number),
        cacheCreationTokens: expect.any(Number),
        totalCostUsd: expect.any(Number),
        numTurns: expect.any(Number),
      });
    });

    it("should support follow-up execution", async () => {
      const engine = new TestEngine();

      const followUpResult = await engine.sendFollowUp?.("Fix the lint errors");

      expect(followUpResult).toBeDefined();
      expect(followUpResult?.success).toBe(true);
      expect(followUpResult?.lastMessage).toContain("Follow-up");
    });
  });

  describe("Configurable behavior", () => {
    it("should support custom response configuration", async () => {
      const engine = new TestEngine({
        success: true,
        lastMessage: "Custom message",
        simulateError: false,
      });

      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agentName: "agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };

      const result = await engine.execute(context);

      expect(result.success).toBe(true);
      expect(result.lastMessage).toContain("Custom message");
    });

    it("should simulate failures when configured", async () => {
      const engine = new TestEngine({
        success: false,
        lastMessage: "Execution failed",
        simulateError: false,
      });

      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agentName: "agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };

      const result = await engine.execute(context);

      expect(result.success).toBe(false);
      expect(result.lastMessage).toContain("Execution failed");
    });

    it("should simulate delays for realistic timing", async () => {
      const engine = new TestEngine({
        simulateDelay: 100,
      });

      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agentName: "agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };

      const start = Date.now();
      await engine.execute(context);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(95);
    });
  });
});
