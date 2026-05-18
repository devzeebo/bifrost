import { describe, expect, it, vi } from "vitest";
import { orchestrate } from "./orchestrator";
import type { AgentDefinition } from "./types";
import type { Task, TaskSource } from "@bifrost-ai/task-source";
import type { Engine } from "@bifrost-ai/engine";

describe("Orchestrator", () => {
  describe("task execution lifecycle", () => {
    it("should validate taskState → execute pre-hooks → invoke engine → execute post-hooks → report success", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: { language: "Python" },
        metadata: { priority: "high" },
      };

      const agent: AgentDefinition = {
        name: "reviewer",
        description: "Code review agent",
        tools: ["readFile", "edit"],
        toolClasses: [],
        template: { parameters: { language: { type: "string" } } },
        hooks: { Start: [], Stop: [] },
        promptBody: "Review the code.",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        // oxlint-disable-next-line no-empty-function
        completeTask: vi.fn().mockResolvedValue(void 0),
        // oxlint-disable-next-line no-empty-function
        failTask: vi.fn().mockResolvedValue(void 0),
        // oxlint-disable-next-line no-empty-function
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: "Review complete",
          stats: {
            durationMs: 5000,
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadTokens: 100,
            cacheCreationTokens: 50,
            totalCostUsd: 0.05,
            numTurns: 3,
          },
        }),
      };

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(result.outcome).toBe("completed");
      expect(mockEngine.execute).toHaveBeenCalled();
      expect(mockTaskSource.completeTask).toHaveBeenCalledWith("task-1");
    });

    it("should fail task when taskState validation fails", async () => {
      const task: Task = {
        id: "task-2",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: "reviewer",
        description: "Code review agent",
        tools: [],
        toolClasses: [],
        template: { parameters: { language: { type: "string" } } },
        hooks: { Start: [], Stop: [] },
        promptBody: "Review the code.",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        // oxlint-disable-next-line no-empty-function
        completeTask: vi.fn().mockResolvedValue(void 0),
        // oxlint-disable-next-line no-empty-function
        failTask: vi.fn().mockResolvedValue(void 0),
        // oxlint-disable-next-line no-empty-function
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: "Done",
          stats: null,
        }),
      };

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(result.outcome).toBe("failed");
      expect(mockTaskSource.failTask).toHaveBeenCalledWith(
        "task-2",
        expect.stringContaining("language"),
      );
      expect(mockEngine.execute).not.toHaveBeenCalled();
    });

    it("should pass setState callback to engine", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: { step: 1 },
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: "test",
        description: "Test",
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: { Start: [], Stop: [] },
        promptBody: "Test",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(void 0),
        failTask: vi.fn().mockResolvedValue(void 0),
        setState: vi.fn().mockResolvedValue(void 0),
      };

      let capturedSetState: ((state: Record<string, unknown>) => Promise<void>) | null = null;

      const mockEngine: Engine = {
        execute: vi.fn().mockImplementation(async (context) => {
          capturedSetState = context.setState;
          return {
            success: true,
            skipFulfill: false,
            lastMessage: "Done",
            stats: null,
          };
        }),
      };

      await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(capturedSetState).toBeDefined();

      await capturedSetState!({ step: 2 });
      expect(mockTaskSource.setState).toHaveBeenCalledWith("task-1", { step: 2 });
    });

    it("should fail task when Start hook returns fatal", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: "test",
        description: "Test",
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [
            {
              name: "fatal-hook",
              fn: async () => ({ outcome: "fatal" as const, message: "Fatal error" }),
            },
          ],
          Stop: [],
        },
        promptBody: "Test",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(void 0),
        failTask: vi.fn().mockResolvedValue(void 0),
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: "Done",
          stats: null,
        }),
      };

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(result.outcome).toBe("failed");
      expect(mockTaskSource.failTask).toHaveBeenCalledWith(
        "task-1",
        expect.stringContaining("Fatal error"),
      );
      expect(mockEngine.execute).not.toHaveBeenCalled();
    });

    it("should skip engine and complete task when Start hook returns skip", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: "test",
        description: "Test",
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [
            {
              name: "skip-check",
              fn: async () => ({ outcome: "skip" as const, message: "already up to date" }),
            },
          ],
          Stop: [],
        },
        promptBody: "Test",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(void 0),
        failTask: vi.fn().mockResolvedValue(void 0),
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: "Done",
          stats: null,
        }),
      };

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(result.outcome).toBe("skipped");
      expect(result.skipReason).toBe("already up to date");
      expect(mockEngine.execute).not.toHaveBeenCalled();
      expect(mockTaskSource.completeTask).toHaveBeenCalledWith("task-1");
    });

    it("should fail task when Stop hook returns fatal", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: "test",
        description: "Test",
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [],
          Stop: [
            {
              name: "fatal-hook",
              fn: async () => ({ outcome: "fatal" as const, message: "Fatal error" }),
            },
          ],
        },
        promptBody: "Test",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(void 0),
        failTask: vi.fn().mockResolvedValue(void 0),
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: "Done",
          stats: null,
        }),
      };

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(result.outcome).toBe("failed");
      expect(mockTaskSource.failTask).toHaveBeenCalledWith(
        "task-1",
        expect.stringContaining("Fatal error"),
      );
    });

    it("should support follow-up loop when Stop hook returns follow-up", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: {},
        metadata: {},
      };

      let stopCallCount = 0;

      const agent: AgentDefinition = {
        name: "test",
        description: "Test",
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [],
          Stop: [
            {
              name: "lint",
              fn: async () => {
                stopCallCount += 1;
                if (stopCallCount === 1) {
                  return { outcome: "follow-up" as const, message: "Fix lint issues" };
                }
                return { outcome: "success" as const };
              },
            },
          ],
        },
        promptBody: "Test",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(void 0),
        failTask: vi.fn().mockResolvedValue(void 0),
        setState: vi.fn().mockResolvedValue(void 0),
      };

      const mockEngine: Engine = {
        execute: vi
          .fn()
          .mockResolvedValueOnce({
            success: true,
            skipFulfill: false,
            lastMessage: "First run",
            stats: null,
          })
          .mockResolvedValueOnce({
            success: true,
            skipFulfill: false,
            lastMessage: "Second run",
            stats: null,
          }),
      };

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(result.outcome).toBe("completed");
      expect(mockEngine.execute).toHaveBeenCalledTimes(2);
    });

    it("should propagate state changes from Start hooks to engine", async () => {
      const task: Task = {
        id: "task-1",
        agentId: "agent-1",
        taskState: { step: 1 },
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: "test",
        description: "Test",
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [
            {
              name: "update-state",
              fn: async (ctx) => {
                await ctx.setTaskState({ step: 2, updatedBy: "hook" });
                return { outcome: "success" as const };
              },
            },
          ],
          Stop: [],
        },
        promptBody: "Test",
      };

      const mockTaskSource: TaskSource = {
        async *watchTasks(): AsyncGenerator<Task> {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(void 0),
        failTask: vi.fn().mockResolvedValue(void 0),
        setState: vi.fn().mockResolvedValue(void 0),
      };

      let engineReceivedState: Record<string, unknown> | null = null;

      const mockEngine: Engine = {
        execute: vi.fn().mockImplementation(async (context) => {
          engineReceivedState = context.taskState;
          return {
            success: true,
            skipFulfill: false,
            lastMessage: "Done",
            stats: null,
          };
        }),
      };

      await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: "/test/project",
      });

      expect(engineReceivedState).toEqual({ step: 2, updatedBy: "hook" });
      expect(mockTaskSource.setState).toHaveBeenCalledWith("task-1", {
        step: 2,
        updatedBy: "hook",
      });
    });
  });
});
