import { describe, expect, it } from "vite-plus/test";
import type { EngineContext, ResolvedToolkitDefinition } from "@bifrost-ai/engine";
import { bindToolkitToClaude } from "./bind-toolkit.js";

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

describe("bindToolkitToClaude", () => {
  it("creates an sdk mcp server config from a toolkit definition", () => {
    const definition: ResolvedToolkitDefinition = {
      name: "devzeebo_node",
      version: "1.0.0",
      tools: [
        {
          name: "install_package",
          description: "install a package",
          inputSchema: {
            type: "object",
            properties: {
              package_name: { type: "string" },
            },
            required: ["package_name"],
          },
          execute: async () => ({
            content: [{ type: "text", text: "ok" }],
          }),
        },
      ],
    };

    const bound = bindToolkitToClaude(definition, makeContext());

    expect(bound.type).toBe("sdk");
    expect(bound.name).toBe("devzeebo_node");
  });
});
