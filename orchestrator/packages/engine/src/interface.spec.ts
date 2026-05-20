// oxlint-disable class-methods-use-this -- mocks
import { describe, expect, it, vi } from "vitest";
import type { Engine, EngineContext, EngineResult } from "./interface";

describe("Engine Interface", () => {
  describe("FR-2: Engine Interface", () => {
    it("should require execute method", async () => {
      class MockEngine implements Engine {
        public async execute(_context: EngineContext): Promise<EngineResult> {
          return {
            success: true,
            skipFulfill: false,
            lastMessage: "test-agent executed",
            stats: {
              durationMs: 1000,
              inputTokens: 100,
              outputTokens: 50,
              cacheReadTokens: 0,
              cacheCreationTokens: 0,
              totalCostUsd: 0.01,
              numTurns: 1,
            },
            sessionId: "session-123",
          };
        }
      }

      const engine = new MockEngine();
      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agent: {
          name: "test-agent",
          description: "",
          tools: [],
          toolClasses: [],
          template: { parameters: {} },
          promptBody: "",
        },
        taskState: {},
        metadata: {},
        instructions: "test instructions",
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const result = await engine.execute(context);
      expect(result.success).toBe(true);
      expect(result.lastMessage).toContain("test-agent");
      expect(result.sessionId).toBe("session-123");
    });

    it("should support session continuation via sessionId parameter", async () => {
      class MockEngine implements Engine {
        public async execute(_context: EngineContext, sessionId?: string): Promise<EngineResult> {
          return {
            success: true,
            skipFulfill: false,
            lastMessage: sessionId ? `Continuing session ${sessionId}` : "New session",
            stats: null,
            sessionId: sessionId ?? "new-session-456",
          };
        }
      }

      const engine = new MockEngine();
      const context: EngineContext = {
        taskId: "task-1",
        workingDir: "/test",
        agent: {
          name: "test-agent",
          description: "",
          tools: [],
          toolClasses: [],
          template: { parameters: {} },
          promptBody: "",
        },
        taskState: {},
        metadata: {},
        instructions: "test instructions",
        setState: vi.fn().mockResolvedValue(void 0),
      };

      // First call creates new session
      const result1 = await engine.execute(context);
      expect(result1.lastMessage).toBe("New session");
      expect(result1.sessionId).toBe("new-session-456");

      // Second call continues session
      const result2 = await engine.execute(context, result1.sessionId);
      expect(result2.lastMessage).toContain("Continuing session new-session-456");
      expect(result2.sessionId).toBe("new-session-456");
    });
  });
});
