import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vite-plus/test";
import type { EngineContext } from "@bifrost-ai/engine";
import type { McpServerConfig, SDKMessage } from "@cursor/sdk";

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(),
    resume: vi.fn(),
  },
  CursorAgentError: class CursorAgentError extends Error {
    public readonly isRetryable = false;
    public constructor(message: string) {
      super(message);
      this.name = "CursorAgentError";
    }
  },
}));

vi.mock("debug", () => ({
  default: vi.fn(() => vi.fn()),
}));

import { Agent, CursorAgentError } from "@cursor/sdk";
import { CursorEngine, type McpToolkitConstructor } from "./cursor-engine.js";

type MockRun = {
  id: string;
  requestId?: string;
  stream: () => AsyncGenerator<SDKMessage, void>;
  wait: () => Promise<{
    id: string;
    requestId?: string;
    status: "finished" | "error" | "cancelled";
    result?: string;
    durationMs?: number;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      totalTokens: number;
    };
  }>;
  cancel: () => Promise<void>;
};

type MockAgent = {
  agentId: string;
  send: (message: string) => Promise<MockRun>;
};

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

const makeRun = (
  options: {
    streamMessages?: SDKMessage[];
    waitResult?: Awaited<ReturnType<MockRun["wait"]>>;
  } = {},
): MockRun => {
  const streamMessages = options.streamMessages ?? [];
  const waitResult = options.waitResult ?? {
    id: "run-1",
    status: "finished" as const,
    result: "done",
    durationMs: 100,
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      totalTokens: 165,
    },
  };

  return {
    id: "run-1",
    requestId: "req-1",
    stream: async function* mockStream() {
      for (const message of streamMessages) {
        yield message;
      }
    },
    wait: vi.fn().mockResolvedValue(waitResult),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
};

const makeAgent = (agentId: string, run: MockRun): MockAgent => ({
  agentId,
  send: vi.fn().mockResolvedValue(run),
});

describe("CursorEngine", () => {
  let mockCreate: MockedFunction<typeof Agent.create>;
  let mockResume: MockedFunction<typeof Agent.resume>;

  beforeEach(() => {
    mockCreate = vi.mocked(Agent.create) as MockedFunction<typeof Agent.create>;
    mockResume = vi.mocked(Agent.resume) as MockedFunction<typeof Agent.resume>;
    mockCreate.mockReset();
    mockResume.mockReset();
    delete process.env.CURSOR_API_KEY;
  });

  describe("execute", () => {
    it("should return success result with agentId as sessionId", async () => {
      const run = makeRun({
        waitResult: {
          id: "run-1",
          status: "finished",
          result: "Fixed the bug in auth.py",
          durationMs: 1500,
          usage: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadTokens: 100,
            cacheWriteTokens: 200,
            totalTokens: 1800,
          },
        },
      });
      mockCreate.mockResolvedValue(makeAgent("agent-123", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(true);
      expect(result.skipFulfill).toBe(false);
      expect(result.lastMessage).toBe("Fixed the bug in auth.py");
      expect(result.sessionId).toBe("agent-123");
      expect(result.stats).toMatchObject({
        durationMs: 1500,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheCreationTokens: 200,
        numTurns: 1,
      });
      expect(result.stats?.totalCostUsd).toBeGreaterThan(0);
    });

    it("should pass workingDir as local.cwd to Agent.create", async () => {
      const run = makeRun();
      mockCreate.mockResolvedValue(makeAgent("agent-cwd", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      await engine.execute(makeContext({ workingDir: "/some/worktree/path" }));

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          local: expect.objectContaining({ cwd: "/some/worktree/path" }),
        }),
      );
    });

    it("should support session continuation via Agent.resume", async () => {
      const firstRun = makeRun();
      const followUpRun = makeRun({
        waitResult: {
          id: "run-2",
          status: "finished",
          result: "follow-up done",
          durationMs: 200,
          usage: {
            inputTokens: 300,
            outputTokens: 150,
            cacheReadTokens: 80,
            cacheWriteTokens: 0,
            totalTokens: 530,
          },
        },
      });

      mockCreate.mockResolvedValueOnce(makeAgent("agent-continue", firstRun) as never);
      mockResume.mockResolvedValueOnce(makeAgent("agent-continue", followUpRun) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const firstResult = await engine.execute(makeContext());
      expect(firstResult.sessionId).toBe("agent-continue");

      const followUpResult = await engine.execute(makeContext(), firstResult.sessionId);
      expect(followUpResult.success).toBe(true);
      expect(followUpResult.lastMessage).toBe("follow-up done");
      expect(followUpResult.sessionId).toBe("agent-continue");

      expect(mockResume).toHaveBeenCalledWith(
        "agent-continue",
        expect.objectContaining({
          local: expect.objectContaining({ cwd: "/test/project", settingSources: [] }),
        }),
      );

      const sendCall = (mockResume.mock.results[0].value as Promise<MockAgent>).then(
        (agent) => agent.send,
      );
      const send = await sendCall;
      expect(send).toHaveBeenCalledWith("Test instructions");
      expect(send).not.toHaveBeenCalledWith(expect.stringContaining("<AgentDefinition>"));
    });

    it("should pass settingSources to Agent.resume", async () => {
      const firstRun = makeRun();
      const followUpRun = makeRun();
      mockCreate.mockResolvedValueOnce(makeAgent("agent-settings", firstRun) as never);
      mockResume.mockResolvedValueOnce(makeAgent("agent-settings", followUpRun) as never);

      const engine = new CursorEngine({
        apiKey: "test-key",
        settingSources: ["user", "project"],
      });
      const first = await engine.execute(makeContext());
      await engine.execute(makeContext(), first.sessionId);

      expect(mockResume).toHaveBeenCalledWith(
        "agent-settings",
        expect.objectContaining({
          local: expect.objectContaining({
            settingSources: ["user", "project"],
          }),
        }),
      );
    });

    it("should cancel and fail when execution times out", async () => {
      const run = makeRun({
        streamMessages: [],
        waitResult: {
          id: "run-timeout",
          status: "finished",
          result: "never",
        },
      });
      run.stream = () =>
        (async function* stalledStream() {
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield {
            type: "usage",
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 2,
            },
          } as SDKMessage;
        })();
      mockCreate.mockResolvedValue(makeAgent("agent-timeout", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key", executionTimeoutMs: 10 });
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(false);
      expect(result.lastMessage).toContain("timed out");
      expect(run.cancel).toHaveBeenCalled();
    });

    it("should build prompt with AgentDefinition and FeatureDefinition on first call", async () => {
      const run = makeRun();
      const agent = makeAgent("agent-prompt", run);
      mockCreate.mockResolvedValue(agent as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      await engine.execute(
        makeContext({
          instructions: "Fix the login bug",
        }),
      );

      expect(agent.send).toHaveBeenCalledWith(
        expect.stringContaining("<AgentDefinition>This is the agent definition</AgentDefinition>"),
      );
      expect(agent.send).toHaveBeenCalledWith(
        expect.stringContaining("<FeatureDefinition>Fix the login bug</FeatureDefinition>"),
      );
    });

    it("should return failure result on CursorAgentError", async () => {
      mockCreate.mockRejectedValue(new CursorAgentError("API rate limit exceeded"));

      const engine = new CursorEngine({ apiKey: "test-key" });
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(false);
      expect(result.lastMessage).toBe("API rate limit exceeded");
      expect(result.stats).toBeNull();
    });

    it("should return failure result when run status is error", async () => {
      const run = makeRun({
        waitResult: {
          id: "run-err",
          status: "error",
          result: "Run failed mid-flight",
          durationMs: 50,
        },
      });
      mockCreate.mockResolvedValue(makeAgent("agent-err", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(false);
      expect(result.lastMessage).toBe("Run failed mid-flight");
    });

    it("should return default message when no response from Cursor", async () => {
      const run = makeRun({
        waitResult: {
          id: "run-empty",
          status: "finished",
          durationMs: 10,
        },
      });
      mockCreate.mockResolvedValue(makeAgent("agent-empty", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(true);
      expect(result.lastMessage).toBe("No response from Cursor");
    });

    it("should fail when API key is missing", async () => {
      const engine = new CursorEngine();
      const result = await engine.execute(makeContext());

      expect(result.success).toBe(false);
      expect(result.lastMessage).toContain("Missing Cursor API key");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should use CURSOR_API_KEY from environment", async () => {
      process.env.CURSOR_API_KEY = "env-key";
      const run = makeRun();
      mockCreate.mockResolvedValue(makeAgent("agent-env", run) as never);

      const engine = new CursorEngine();
      await engine.execute(makeContext());

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "env-key" }));
    });

    it("should count usage stream events as numTurns", async () => {
      const run = makeRun({
        streamMessages: [
          {
            type: "usage",
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 2,
            },
          },
          {
            type: "usage",
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 2,
            },
          },
          {
            type: "usage",
            usage: {
              inputTokens: 1,
              outputTokens: 1,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 2,
            },
          },
        ] as SDKMessage[],
      });
      mockCreate.mockResolvedValue(makeAgent("agent-turns", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const result = await engine.execute(makeContext());

      expect(result.stats?.numTurns).toBe(3);
    });
  });

  describe("registerToolkit", () => {
    const makeToolkit = (name: string): McpServerConfig =>
      ({
        type: "stdio",
        command: "node",
        args: [name],
      }) satisfies McpServerConfig;

    it("should pass registered toolkit to mcpServers when agent uses its tools", async () => {
      const run = makeRun();
      mockCreate.mockResolvedValue(makeAgent("agent-mcp", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const toolkit = makeToolkit("mycustomtoolkit");
      engine.registerToolkit("mycustomtoolkit", toolkit);

      await engine.execute(
        makeContext({
          agent: {
            name: "test-agent",
            description: "",
            tools: ["mcp__mycustomtoolkit__toolone"],
            template: { parameters: {} },
            promptBody: "This is the agent definition",
          },
        }),
      );

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServers: { mycustomtoolkit: toolkit },
        }),
      );
    });

    it("should re-pass mcpServers on Agent.resume", async () => {
      const firstRun = makeRun();
      const followUpRun = makeRun();
      mockCreate.mockResolvedValueOnce(makeAgent("agent-mcp-resume", firstRun) as never);
      mockResume.mockResolvedValueOnce(makeAgent("agent-mcp-resume", followUpRun) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const toolkit = makeToolkit("resumetoolkit");
      engine.registerToolkit("resumetoolkit", toolkit);

      const context = makeContext({
        agent: {
          name: "test-agent",
          description: "",
          tools: ["mcp__resumetoolkit__tool"],
          template: { parameters: {} },
          promptBody: "This is the agent definition",
        },
      });

      const first = await engine.execute(context);
      await engine.execute(context, first.sessionId);

      expect(mockResume).toHaveBeenCalledWith(
        "agent-mcp-resume",
        expect.objectContaining({
          mcpServers: { resumetoolkit: toolkit },
        }),
      );
    });

    it("should call a toolkit constructor with the engine context", async () => {
      const run = makeRun();
      mockCreate.mockResolvedValue(makeAgent("agent-construct", run) as never);

      const engine = new CursorEngine({ apiKey: "test-key" });
      const builtToolkit = makeToolkit("constructedtoolkit");
      const constructor: McpToolkitConstructor = vi.fn().mockReturnValue(builtToolkit);
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
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServers: { constructedtoolkit: builtToolkit },
        }),
      );
    });
  });
});
