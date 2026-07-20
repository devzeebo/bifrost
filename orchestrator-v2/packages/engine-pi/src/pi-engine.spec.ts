import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import type { EngineContext } from "@bifrost-ai/engine";

const {
  mockCreateAgentSession,
  mockModelRuntimeCreate,
  mockResolveCliModel,
  mockSessionManagerCreate,
  mockSessionManagerOpen,
  mockSettingsInMemory,
  mockLoaderReload,
  mockDefaultResourceLoader,
} = vi.hoisted(() => ({
  mockCreateAgentSession: vi.fn(),
  mockModelRuntimeCreate: vi.fn(),
  mockResolveCliModel: vi.fn(),
  mockSessionManagerCreate: vi.fn(),
  mockSessionManagerOpen: vi.fn(),
  mockSettingsInMemory: vi.fn(),
  mockLoaderReload: vi.fn(),
  mockDefaultResourceLoader: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSession: mockCreateAgentSession,
  DefaultResourceLoader: class {
    constructor(options: unknown) {
      mockDefaultResourceLoader(options);
    }
    reload = mockLoaderReload;
  },
  getAgentDir: vi.fn(() => "/fake/agent-dir"),
  ModelRuntime: {
    create: mockModelRuntimeCreate,
  },
  resolveCliModel: mockResolveCliModel,
  SessionManager: {
    create: mockSessionManagerCreate,
    open: mockSessionManagerOpen,
  },
  SettingsManager: {
    inMemory: mockSettingsInMemory,
  },
  defineTool: (tool: unknown) => tool,
}));

vi.mock("debug", () => ({
  default: vi.fn(() => vi.fn()),
}));

import { PiEngine } from "./pi-engine.js";

const makeContext = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  workItemId: "work-item-1",
  workingDir: "/tmp/pi-engine-test-project",
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

type MockSession = {
  prompt: MockedFunction<(text: string) => Promise<void>>;
  subscribe: MockedFunction<(listener: (event: unknown) => void) => () => void>;
  bindExtensions: MockedFunction<(bindings: unknown) => Promise<void>>;
  getLastAssistantText: MockedFunction<() => string | undefined>;
  getSessionStats: MockedFunction<
    () => {
      tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
      };
      cost: number;
    }
  >;
  dispose: MockedFunction<() => void>;
  sessionFile: string | undefined;
  sessionId: string;
};

const createMockSession = (overrides: Partial<MockSession> = {}): MockSession => {
  const session: MockSession = {
    prompt: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((listener: (event: unknown) => void) => {
      listener({ type: "turn_end" });
      return vi.fn();
    }),
    bindExtensions: vi.fn().mockResolvedValue(undefined),
    getLastAssistantText: vi.fn().mockReturnValue("done"),
    getSessionStats: vi.fn().mockReturnValue({
      tokens: { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, total: 165 },
      cost: 0.01,
    }),
    dispose: vi.fn(),
    sessionFile: "/tmp/pi-engine-test-project/.bifrost/pi-sessions/sess-1.jsonl",
    sessionId: "sess-1",
    ...overrides,
  };
  return session;
};

describe("PiEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoaderReload.mockResolvedValue(undefined);
    mockSettingsInMemory.mockReturnValue({ kind: "settings" });
    mockSessionManagerCreate.mockReturnValue({ kind: "session-manager-new" });
    mockSessionManagerOpen.mockReturnValue({ kind: "session-manager-open" });
    mockModelRuntimeCreate.mockResolvedValue({
      setRuntimeApiKey: vi.fn().mockResolvedValue(undefined),
    });
    mockResolveCliModel.mockReturnValue({
      model: { id: "claude-opus-4-5", provider: "anthropic" },
      thinkingLevel: "medium",
      warning: undefined,
      error: undefined,
    });
  });

  it("creates a session, prompts with full agent definition, and returns stats", async () => {
    const session = createMockSession();
    mockCreateAgentSession.mockResolvedValue({ session, extensionsResult: { extensions: [] } });

    const engine = new PiEngine({ model: "anthropic/claude-opus-4-5" });
    const result = await engine.execute(
      makeContext({
        agent: {
          name: "test-agent",
          description: "",
          tools: ["Read(./**)", "Write(*.ts)"],
          template: { parameters: {} },
          promptBody: "This is the agent definition",
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.lastMessage).toBe("done");
    expect(result.sessionId).toBe("/tmp/pi-engine-test-project/.bifrost/pi-sessions/sess-1.jsonl");
    expect(result.stats).toEqual(
      expect.objectContaining({
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 10,
        cacheCreationTokens: 5,
        totalCostUsd: 0.01,
        numTurns: 1,
      }),
    );

    expect(session.prompt).toHaveBeenCalledWith(
      expect.stringContaining("<AgentDefinition>This is the agent definition</AgentDefinition>"),
    );
    expect(session.prompt).toHaveBeenCalledWith(
      expect.stringContaining("<FeatureDefinition>Test instructions</FeatureDefinition>"),
    );
    expect(session.dispose).toHaveBeenCalled();

    const createArgs = mockCreateAgentSession.mock.calls[0]?.[0] as {
      tools: string[];
      noTools?: string;
    };
    expect(createArgs.tools).toEqual(expect.arrayContaining(["read", "write"]));
    expect(createArgs.tools).not.toContain("bash");
    expect(createArgs.noTools).toBeUndefined();
  });

  it("on resume uses instructions-only prompt and opens the session file", async () => {
    const session = createMockSession();
    mockCreateAgentSession.mockResolvedValue({ session, extensionsResult: { extensions: [] } });

    const engine = new PiEngine();
    const sessionPath = "/tmp/pi-engine-test-project/.bifrost/pi-sessions/sess-1.jsonl";
    await engine.execute(makeContext({ instructions: "Follow-up" }), sessionPath);

    expect(mockSessionManagerOpen).toHaveBeenCalledWith(
      sessionPath,
      expect.stringContaining(".bifrost/pi-sessions"),
      "/tmp/pi-engine-test-project",
    );
    expect(session.prompt).toHaveBeenCalledWith("Follow-up");
  });

  it("passes noTools all when agent has no tools", async () => {
    const session = createMockSession();
    mockCreateAgentSession.mockResolvedValue({ session, extensionsResult: { extensions: [] } });

    const engine = new PiEngine();
    await engine.execute(makeContext());

    const createArgs = mockCreateAgentSession.mock.calls[0]?.[0] as { noTools?: string };
    expect(createArgs.noTools).toBe("all");
  });

  it("binds registered toolkits referenced by mcp__ tools", async () => {
    const session = createMockSession();
    mockCreateAgentSession.mockResolvedValue({ session, extensionsResult: { extensions: [] } });

    const engine = new PiEngine();
    const toolkitPath = fileURLToPath(new URL("./test-fixtures/test-toolkit.ts", import.meta.url));
    engine.registerToolkit("testtoolkit", toolkitPath);

    await engine.execute(
      makeContext({
        agent: {
          name: "test-agent",
          description: "",
          tools: ["mcp__testtoolkit__echo"],
          template: { parameters: {} },
          promptBody: "body",
        },
      }),
    );

    const createArgs = mockCreateAgentSession.mock.calls[0]?.[0] as {
      tools: string[];
      customTools: Array<{ name: string }>;
    };
    expect(createArgs.customTools.map((tool) => tool.name)).toContain("mcp__testtoolkit__echo");
    expect(createArgs.tools).toContain("mcp__testtoolkit__echo");
  });

  it("returns failure when prompt throws", async () => {
    const session = createMockSession({
      prompt: vi.fn().mockRejectedValue(new Error("boom")),
    });
    mockCreateAgentSession.mockResolvedValue({ session, extensionsResult: { extensions: [] } });

    const engine = new PiEngine();
    const result = await engine.execute(makeContext());

    expect(result.success).toBe(false);
    expect(result.lastMessage).toBe("boom");
    expect(session.dispose).toHaveBeenCalled();
  });

  it("throws when model resolution fails", async () => {
    mockResolveCliModel.mockReturnValue({
      model: undefined,
      thinkingLevel: undefined,
      warning: undefined,
      error: "unknown model",
    });
    mockCreateAgentSession.mockResolvedValue({
      session: createMockSession(),
      extensionsResult: { extensions: [] },
    });

    const engine = new PiEngine({ model: "bad/model" });
    const result = await engine.execute(makeContext());

    expect(result.success).toBe(false);
    expect(result.lastMessage).toContain("Failed to resolve Pi model");
  });
});
