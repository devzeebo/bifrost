import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineContext } from "@bifrost-ai/engine";
import { DevinCliEngine } from "./devin-engine.js";

// Mock the entire devin-cli module
const mockExecute = vi.fn();

vi.mock("./devin-cli.js", () => ({
  DevinCli: vi.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

const makeContext = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  taskId: "task-1",
  workingDir: "/test/project",
  agent: {
    name: "test-agent",
    description: "",
    tools: [],
    template: { parameters: {} },
    promptBody: "This is the agent definition",
  },
  taskState: {},
  metadata: {},
  instructions: "Test instructions",
  setState: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("DevinCliEngine", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should execute successfully and return result with session ID", async () => {
      mockExecute.mockResolvedValue({
        exitCode: 0,
        stdout: "Session ID: abc123\n\nTask completed successfully",
        stderr: "",
        success: true,
      });

      const context = makeContext();
      const engine = new DevinCliEngine("/test/project");
      const result = await engine.execute(context);

      expect(result.success).toBe(true);
      expect(result.lastMessage).toBe("Task completed successfully");
      expect(result.sessionId).toBe("abc123");
      expect(result.stats).not.toBeNull();
    });

    it("should continue existing session when sessionId is provided", async () => {
      mockExecute.mockResolvedValue({
        exitCode: 0,
        stdout: "Task continued successfully",
        stderr: "",
        success: true,
      });

      const context = makeContext();
      const engine = new DevinCliEngine("/test/project");
      const result = await engine.execute(context, "existing-session-456");

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe("existing-session-456");
      expect(mockExecute).toHaveBeenCalledWith(
        "Test instructions",
        "existing-session-456",
        [], // No tools in this test
      );
    });

    it("should handle CLI errors gracefully", async () => {
      mockExecute.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "Command failed: devin not found",
        success: false,
      });

      const context = makeContext();
      const engine = new DevinCliEngine("/test/project");
      const result = await engine.execute(context);

      expect(result.success).toBe(false);
      expect(result.lastMessage).toContain("Command failed: devin not found");
    });

    it("should handle exceptions during execution", async () => {
      mockExecute.mockRejectedValue(new Error("Network error"));

      const context = makeContext();
      const engine = new DevinCliEngine("/test/project");
      const result = await engine.execute(context);

      expect(result.success).toBe(false);
      expect(result.lastMessage).toContain("Execution failed");
    });

    it("should parse statistics from output when available", async () => {
      mockExecute.mockResolvedValue({
        exitCode: 0,
        stdout: "Session ID: stats-123\n\nTask done\n\nTokens: 1500\nCost: $0.05",
        stderr: "",
        success: true,
      });

      const context = makeContext();
      const engine = new DevinCliEngine("/test/project");
      const result = await engine.execute(context);

      expect(result.success).toBe(true);
      expect(result.stats?.inputTokens).toBe(1500);
      expect(result.stats?.totalCostUsd).toBe(0.05);
    });

    it("should handle output without session ID", async () => {
      mockExecute.mockResolvedValue({
        exitCode: 0,
        stdout: "Task completed",
        stderr: "",
        success: true,
      });

      const context = makeContext();
      const engine = new DevinCliEngine("/test/project");
      const result = await engine.execute(context);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeUndefined();
    });
  });

  describe("constructor", () => {
    it("should use provided working directory", () => {
      const testEngine = new DevinCliEngine("/custom/dir");
      expect(testEngine).toBeDefined();
    });

    it("should use current directory when no cwd provided", () => {
      const testEngine = new DevinCliEngine();
      expect(testEngine).toBeDefined();
    });
  });
});
