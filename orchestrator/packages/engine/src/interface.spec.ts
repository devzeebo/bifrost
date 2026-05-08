import { describe, expect, it, vi } from "vitest";
import type { Engine } from "./interface.js";
import type { EngineContext, EngineResult } from "./types.js";

describe("Engine Interface", () => {
  describe("FR-2: Engine Interface", () => {
    it("should require execute method", async () => {
      class MockEngine implements Engine {
        async execute(context: EngineContext): Promise<EngineResult> {
          return {
            success: true,
            skipFulfill: false,
            lastMessage: `Executed ${context.agentName}`,
            stats: {
              durationMs: 1000,
              inputTokens: 100,
              outputTokens: 50,
              cacheReadTokens: 0,
              cacheCreationTokens: 0,
              totalCostUsd: 0.01,
              numTurns: 1,
            },
          };
        }
      }

      const engine = new MockEngine();
      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agentName: "test-agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };

      const result = await engine.execute(context);
      expect(result.success).toBe(true);
      expect(result.lastMessage).toContain("test-agent");
    });

    it("should require optional sendFollowUp method", async () => {
      class MockEngineWithFollowUp implements Engine {
        async execute(): Promise<EngineResult> {
          return {
            success: true,
            skipFulfill: false,
            lastMessage: "Initial",
            stats: null,
          };
        }

        async sendFollowUp(message: string): Promise<EngineResult> {
          return {
            success: true,
            skipFulfill: false,
            lastMessage: `Follow-up: ${message}`,
            stats: null,
          };
        }
      }

      const engine = new MockEngineWithFollowUp();

      // sendFollowUp is optional - check if it exists
      if ("sendFollowUp" in engine) {
        const result = await engine.sendFollowUp("Fix the lint errors");
        expect(result.lastMessage).toContain("Follow-up");
      }
    });

    it("should allow engine without sendFollowUp", async () => {
      class MockEngine implements Engine {
        async execute(_context: EngineContext): Promise<EngineResult> {
          return {
            success: true,
            skipFulfill: false,
            lastMessage: "Done",
            stats: null,
          };
        }
      }

      const engine: Engine = new MockEngine();
      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agentName: "test-agent",
        taskState: {},
        metadata: {},
        setState: vi.fn().mockResolvedValue(undefined),
        verbose: false,
      };
      const result = await engine.execute(context);

      expect(result.success).toBe(true);
      // sendFollowUp is optional, so engine doesn't need it
      expect("sendFollowUp" in engine).toBe(false);
    });
  });
});
