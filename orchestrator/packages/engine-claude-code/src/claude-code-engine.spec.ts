import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { ClaudeCodeEngine } from "./claude-code-engine";
import type { EngineContext } from "@bifrost-ai/engine";
import type { query as queryFn, SDKMessage, Query } from "@anthropic-ai/claude-agent-sdk";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

const makeContext = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  taskId: "task-1",
  workingDir: "/test/project",
  agentName: "test-agent",
  taskState: {},
  metadata: {},
  setState: vi.fn().mockResolvedValue(undefined),
  verbose: false,
  ...overrides,
});

const systemInit = (sessionId: string) => ({
  type: "system" as const,
  subtype: "init" as const,
  session_id: sessionId,
  uuid: "uuid-init",
  apiKeySource: "environment",
  cwd: "/test",
  tools: [],
  mcp_servers: [],
  model: "claude-opus-4-7",
  permissionMode: "acceptEdits",
  slash_commands: [],
  output_style: "default",
});

const resultSuccess = (
  overrides: Partial<{
    session_id: string;
    result: string;
    num_turns: number;
    total_cost_usd: number;
    duration_ms: number;
    usage: Record<string, number>;
  }> = {},
) => ({
  type: "result" as const,
  subtype: "success" as const,
  session_id: "sess-1",
  uuid: "uuid-result",
  duration_ms: 100,
  duration_api_ms: 50,
  is_error: false,
  num_turns: 1,
  result: "done",
  total_cost_usd: 0.01,
  usage: { input_tokens: 100, output_tokens: 50 },
  modelUsage: {},
  permission_denials: [],
  ...overrides,
});

const mockStream = (...messages: unknown[]): Query =>
  (async function* mockGenerator() {
    for (const msg of messages) {
      yield msg as SDKMessage;
    }
  })() as Query;

const mockErrorStream = (error: Error): Query =>
  ({
    [Symbol.asyncIterator]() {
      let thrown = false;
      return {
        next() {
          if (thrown) {
            return Promise.resolve({ done: true, value: undefined });
          }
          thrown = true;
          return Promise.reject(error);
        },
      };
    },
  }) as Query;

const mockEmptyStream = (): Query =>
  (async function* mockEmptyGenerator() {
    // intentionally empty
  })() as Query;

describe("ClaudeCodeEngine", () => {
  let mockQuery: MockedFunction<typeof queryFn> = vi.fn();

  beforeEach(async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    mockQuery = vi.mocked(query);
    mockQuery.mockReset();
  });

  describe("execute", () => {
    it("should return success result from SDK result message", async () => {
      mockQuery.mockReturnValue(
        mockStream(
          systemInit("sess-123"),
          resultSuccess({
            session_id: "sess-123",
            duration_ms: 1500,
            num_turns: 3,
            result: "Fixed the bug in auth.py",
            total_cost_usd: 0.045,
            usage: {
              input_tokens: 1000,
              output_tokens: 500,
              cache_creation_input_tokens: 200,
              cache_read_input_tokens: 100,
            },
          }),
        ),
      );

      const engine = new ClaudeCodeEngine();
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(true);
      expect(result.skipFulfill).toBe(false);
      expect(result.lastMessage).toBe("Fixed the bug in auth.py");
      expect(result.sessionId).toBe("sess-123");
      expect(result.stats).toMatchObject({
        durationMs: 1500,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheCreationTokens: 200,
        totalCostUsd: 0.045,
        numTurns: 3,
      });
    });

    it("should capture and return session ID for continuation", async () => {
      mockQuery.mockReturnValue(
        mockStream(systemInit("sess-abc"), resultSuccess({ session_id: "sess-abc" })),
      );

      const engine = new ClaudeCodeEngine();
      const result = await engine.execute(makeContext());

      expect(result.sessionId).toBe("sess-abc");
    });

    it("should support session continuation via sessionId parameter", async () => {
      mockQuery.mockReturnValueOnce(
        mockStream(systemInit("sess-continue"), resultSuccess({ session_id: "sess-continue" })),
      );

      mockQuery.mockReturnValueOnce(
        mockStream(
          resultSuccess({
            session_id: "sess-continue",
            num_turns: 2,
            duration_ms: 200,
            result: "follow-up done",
            total_cost_usd: 0.02,
            usage: { input_tokens: 300, output_tokens: 150, cache_read_input_tokens: 80 },
          }),
        ),
      );

      const engine = new ClaudeCodeEngine();
      const firstResult = await engine.execute(makeContext());
      expect(firstResult.sessionId).toBe("sess-continue");

      const followUpResult = await engine.execute(makeContext(), firstResult.sessionId);
      expect(followUpResult.success).toBe(true);
      expect(followUpResult.lastMessage).toBe("follow-up done");
      expect(followUpResult.stats?.numTurns).toBe(2);
      expect(followUpResult.sessionId).toBe("sess-continue");

      const secondCall = mockQuery.mock.calls[1][0] as {
        options: { resume: string };
      };
      expect(secondCall.options.resume).toBe("sess-continue");
    });

    it("should extract text from assistant messages", async () => {
      mockQuery.mockReturnValue(
        mockStream(
          {
            type: "assistant",
            uuid: "uuid-1",
            session_id: "sess-1",
            parent_tool_use_id: null,
            message: {
              role: "assistant",
              content: [
                { type: "text", text: "I found the issue" },
                { type: "tool_use", id: "tu-1", name: "Read", input: {} },
              ],
            },
          },
          resultSuccess({ session_id: "sess-1", duration_ms: 500, result: "Final answer" }),
        ),
      );

      const engine = new ClaudeCodeEngine();
      const result = await engine.execute(makeContext());

      expect(result.lastMessage).toBe("Final answer");
    });

    it("should return failure result on SDK error", async () => {
      mockQuery.mockReturnValue(mockErrorStream(new Error("API rate limit exceeded")));

      const engine = new ClaudeCodeEngine();
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(false);
      expect(result.lastMessage).toBe("API rate limit exceeded");
      expect(result.stats).toBeNull();
    });

    it("should return default message when no response from Claude", async () => {
      mockQuery.mockReturnValue(mockEmptyStream());

      const engine = new ClaudeCodeEngine();
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(true);
      expect(result.lastMessage).toBe("No response from Claude");
      expect(result.stats).toBeNull();
    });

    it("should build prompt from context metadata", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          taskState: { file: "auth.py" },
          metadata: { description: "Fix the login bug" },
          instructions: "Be thorough",
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Fix the login bug"),
        }),
      );
      const callPrompt = mockQuery.mock.calls[0][0] as { prompt: string };
      expect(callPrompt.prompt).toContain("Context:");
      expect(callPrompt.prompt).toContain("file");
      expect(callPrompt.prompt).toContain("Be thorough");
    });

    it("should log messages when verbose is true", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(makeContext({ verbose: true }));

      expect(logSpy).toHaveBeenCalledWith("[claude-code-engine]", expect.any(String));
      logSpy.mockRestore();
    });
  });
});
