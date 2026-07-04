import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vite-plus/test";
import type { EngineContext } from "@bifrost-ai/engine";
import type {
  query as queryFn,
  SDKMessage,
  Query,
  McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

vi.mock("debug", () => ({
  default: vi.fn(() => vi.fn()),
}));

import { ClaudeCodeEngine, type ToolkitConstructor } from "./claude-code-engine.js";

const makeContext = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  workItemId: "work-item-1",
  workingDir: "/test/project",
  agent: {
    name: "test-agent",
    description: "",
    tools: [],

    template: { parameters: {} },
    promptBody: "This is the agent definition",
  },
  state: {},
  metadata: {},
  instructions: "Test instructions",
  setState: vi.fn().mockResolvedValue(undefined),
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

    it("should pass workingDir as cwd to the SDK", async () => {
      mockQuery.mockReturnValue(
        mockStream(systemInit("sess-cwd"), resultSuccess({ session_id: "sess-cwd" })),
      );

      const engine = new ClaudeCodeEngine();
      await engine.execute(makeContext({ workingDir: "/some/worktree/path" }));

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ cwd: "/some/worktree/path" }),
        }),
      );
    });

    it("should pass workingDir as cwd when resuming a session", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess({ session_id: "sess-resume" })));

      const engine = new ClaudeCodeEngine();
      await engine.execute(makeContext({ workingDir: "/some/worktree/path" }), "sess-resume");

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ cwd: "/some/worktree/path" }),
        }),
      );
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
        prompt: string;
        options: { resume: string };
      };
      expect(secondCall.options.resume).toBe("sess-continue");
      expect(secondCall.prompt).toBe("Test instructions");
      expect(secondCall.prompt).not.toContain("<AgentDefinition>");
      expect(secondCall.prompt).not.toContain("<FeatureDefinition>");
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

    it("should pass bare tool names to tools and full permissions to allowedTools", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["Write(/**/*.spec.ts)", "Write(/**/*.spec.tsx)", "Read"],

            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            tools: ["Write", "Read"],
            allowedTools: ["Write(/**/*.spec.ts)", "Write(/**/*.spec.tsx)", "Read"],
          }),
        }),
      );
    });

    it("should build prompt with agent prompt in AgentDefinition and task instructions in FeatureDefinition", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          state: { file: "auth.py" },
          metadata: { description: "Fix the login bug" },
          instructions: "Fix the login bug",
        }),
      );

      const call = mockQuery.mock.calls[0][0] as { prompt: string };
      expect(call.prompt).toContain(
        "<AgentDefinition>This is the agent definition</AgentDefinition>",
      );
      expect(call.prompt).toContain("<FeatureDefinition>Fix the login bug</FeatureDefinition>");
    });
  });

  describe("Tool permission expansion", () => {
    it("should expand object tool with allow patterns into allowedTools", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: [
              {
                name: "Write",
                allow: ["/src/**", "/**/*.spec.ts"],
              },
            ],

            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            tools: ["Write"],
            allowedTools: ["Write(/src/**)", "Write(/**/*.spec.ts)"],
          }),
        }),
      );
    });

    it("should expand object tool deny patterns into denyTools", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: [
              {
                name: "Write",
                deny: ["/src/package.json"],
              },
            ],

            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            tools: ["Write"],
            denyTools: ["Write(/src/package.json)"],
          }),
        }),
      );
    });

    it("should handle mixed shorthand and object tools", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: [
              "Read",
              {
                name: "Write",
                allow: ["/src/**"],
                deny: ["/src/package.json"],
              },
            ],

            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            tools: ["Read", "Write"],
            allowedTools: ["Read", "Write(/src/**)"],
            denyTools: ["Write(/src/package.json)"],
          }),
        }),
      );
    });

    it("should omit denyTools when no deny patterns", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: [
              {
                name: "Write",
                allow: ["/src/**", "/**/*.spec.ts"],
              },
            ],

            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      const call = mockQuery.mock.calls[0][0] as {
        options: Record<string, unknown>;
      };
      expect(call.options.denyTools).toBeUndefined();
    });

    it("should omit allowedTools when no allow patterns and only shorthand tools", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["Read", "Write"],

            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      const call = mockQuery.mock.calls[0][0] as {
        options: Record<string, unknown>;
      };
      expect(call.options.allowedTools).toEqual(["Read", "Write"]);
    });
  });

  describe("registerToolkit", () => {
    const makeToolkit = (name: string): McpSdkServerConfigWithInstance =>
      ({
        type: "sdk",
        name,
        instance: {} as McpSdkServerConfigWithInstance["instance"],
      }) satisfies McpSdkServerConfigWithInstance;

    it("should pass registered toolkit to mcpServers when agent uses its tools", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      const toolkit = makeToolkit("mycustomtoolkit");
      engine.registerToolkit("mycustomtoolkit", toolkit);

      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["mcp__mycustomtoolkit__toolone", "mcp__mycustomtoolkit__tooltwo"],
            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            mcpServers: { mycustomtoolkit: toolkit },
          }),
        }),
      );
    });

    it("should not include a toolkit when no agent tools reference it", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      engine.registerToolkit("unusedtoolkit", makeToolkit("unusedtoolkit"));

      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["Read", "Write"],
            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      const call = mockQuery.mock.calls[0][0] as { options: Record<string, unknown> };
      expect(call.options.mcpServers).toBeUndefined();
    });

    it("should omit mcpServers entirely when no toolkits are registered", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();

      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["Read"],
            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      const call = mockQuery.mock.calls[0][0] as { options: Record<string, unknown> };
      expect(call.options.mcpServers).toBeUndefined();
    });

    it("should only include toolkits whose tools are referenced by the agent", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      const activeToolkit = makeToolkit("activetoolkit");
      const inactiveToolkit = makeToolkit("inactivetoolkit");
      engine.registerToolkit("activetoolkit", activeToolkit);
      engine.registerToolkit("inactivetoolkit", inactiveToolkit);

      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["mcp__activetoolkit__toolone"],
            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            mcpServers: { activetoolkit: activeToolkit },
          }),
        }),
      );
    });

    it("should call a toolkit constructor with the engine context and pass the result to mcpServers", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      const builtToolkit = makeToolkit("constructedtoolkit");
      const constructor: ToolkitConstructor = vi.fn().mockReturnValue(builtToolkit);
      engine.registerToolkit("constructedtoolkit", constructor);

      const context = makeContext({
        workingDir: "/project/cwd",
        agent: {
          name: "test-agent",
          description: "",
          tools: ["mcp__constructedtoolkit__mytool"],
          template: { parameters: {} },
          promptBody: "This is the agent definition",
        },
      });
      await engine.execute(context);

      expect(constructor).toHaveBeenCalledWith(context);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            mcpServers: { constructedtoolkit: builtToolkit },
          }),
        }),
      );
    });

    it("should pass the full engine context including workingDir to the toolkit constructor", async () => {
      mockQuery.mockReturnValue(mockStream(resultSuccess()));

      const engine = new ClaudeCodeEngine();
      const captured: { context: EngineContext | undefined } = { context: undefined };
      const constructor: ToolkitConstructor = (ctx) => {
        captured.context = ctx;
        return makeToolkit("ctxcheck");
      };
      engine.registerToolkit("ctxcheck", constructor);

      const context = makeContext({
        workingDir: "/some/specific/path",
        agent: {
          name: "test-agent",
          description: "",
          tools: ["mcp__ctxcheck__tool"],
          template: { parameters: {} },
          promptBody: "This is the agent definition",
        },
      });
      await engine.execute(context);

      expect(captured.context?.workingDir).toBe("/some/specific/path");
      expect(captured.context?.workItemId).toBe(context.workItemId);
    });
  });
});
