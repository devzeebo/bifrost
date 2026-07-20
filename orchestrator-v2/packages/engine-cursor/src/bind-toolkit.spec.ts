import { describe, expect, it } from "vite-plus/test";
import type { EngineContext } from "@bifrost-ai/engine";
import type { McpServerConfig } from "@cursor/sdk";
import { bindToolkitToCursor } from "./bind-toolkit.js";

const makeContext = (): EngineContext => ({
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
});

describe("bindToolkitToCursor", () => {
  it("creates a stdio mcp server config with toolkit module env", () => {
    const bound = bindToolkitToCursor("@tools/node/toolkit-entry", makeContext());

    expect(bound).toMatchObject({ type: "stdio" });
    if (!("command" in bound)) {
      throw new Error("expected stdio config");
    }
    const stdio = bound as Extract<McpServerConfig, { command: string }>;

    expect(stdio.command).toBe(process.execPath);
    expect(stdio.args?.[0]).toMatch(/mcp-bridge\.mjs$/);
    expect(stdio.env?.BIFROST_TOOLKIT_MODULE).toBe("@tools/node/toolkit-entry");
    expect(JSON.parse(stdio.env?.BIFROST_TOOLKIT_CONTEXT ?? "{}")).toEqual({
      workItemId: "work-1",
      workingDir: "/project",
    });
  });
});
