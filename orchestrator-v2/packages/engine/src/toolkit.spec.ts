import { describe, expect, it } from "vite-plus/test";
import {
  resolveToolkit,
  stubEngineContext,
  toToolkitContext,
  type ToolkitDefinition,
} from "./toolkit.js";
import type { EngineContext } from "./types.js";

const makeContext = (overrides: Partial<EngineContext> = {}): EngineContext => ({
  workItemId: "work-1",
  workingDir: "/project",
  agent: {
    name: "agent",
    description: "",
    tools: [],
    template: { parameters: {} },
    promptBody: "",
  },
  state: {},
  metadata: {},
  instructions: "",
  setState: async () => undefined,
  ...overrides,
});

describe("resolveToolkit", () => {
  it("resolves a static toolkit definition", () => {
    const definition: ToolkitDefinition = {
      name: "test",
      version: "1.0.0",
      tools: [
        {
          name: "echo",
          description: "echo",
          inputSchema: { type: "object", properties: {} },
          execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
        },
      ],
    };

    const resolved = resolveToolkit(definition, makeContext());

    expect(resolved.tools).toHaveLength(1);
    expect(resolved.tools[0]?.name).toBe("echo");
  });

  it("resolves tools from a factory function", () => {
    const definition: ToolkitDefinition = {
      name: "test",
      version: "1.0.0",
      tools: (context) => [
        {
          name: "cwd",
          description: "cwd",
          inputSchema: { type: "object", properties: {} },
          execute: async () => ({
            content: [{ type: "text", text: context.workingDir }],
          }),
        },
      ],
    };

    const resolved = resolveToolkit(definition, makeContext({ workingDir: "/tmp" }));

    expect(resolved.tools[0]?.name).toBe("cwd");
  });
});

describe("toToolkitContext", () => {
  it("keeps only serializable fields", () => {
    const context = makeContext({ workingDir: "/repo", workItemId: "abc" });

    expect(toToolkitContext(context)).toEqual({
      workItemId: "abc",
      workingDir: "/repo",
    });
  });
});

describe("stubEngineContext", () => {
  it("reconstructs a minimal engine context", () => {
    const context = stubEngineContext({ workItemId: "abc", workingDir: "/repo" });

    expect(context.workingDir).toBe("/repo");
    expect(context.agent.name).toBe("");
    expect(context.setState).toBeTypeOf("function");
  });
});
