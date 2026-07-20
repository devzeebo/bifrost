import { describe, expect, it } from "vite-plus/test";
import type { EngineContext, ResolvedToolkitDefinition } from "@bifrost-ai/engine";

import { bindToolkitToPi, jsonSchemaToTypeBox } from "./bind-toolkit.js";

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

describe("jsonSchemaToTypeBox", () => {
  it("converts object properties with required and optional fields", () => {
    const schema = jsonSchemaToTypeBox({
      type: "object",
      properties: {
        package_name: { type: "string", description: "npm package" },
        version: { type: "string" },
      },
      required: ["package_name"],
    });

    expect(schema.type).toBe("object");
    expect(schema.properties?.package_name).toBeDefined();
    expect(schema.required).toContain("package_name");
  });
});

describe("bindToolkitToPi", () => {
  it("creates Pi custom tools with mcp__ toolkit naming", async () => {
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
          execute: async (args) => ({
            content: [{ type: "text", text: `installed ${String(args.package_name)}` }],
          }),
        },
      ],
    };

    const bound = bindToolkitToPi(definition, makeContext());

    expect(bound).toHaveLength(1);
    expect(bound[0]?.name).toBe("mcp__devzeebo_node__install_package");
    expect(bound[0]?.description).toBe("install a package");

    const result = await bound[0]?.execute(
      "call-1",
      { package_name: "lodash" },
      undefined,
      undefined,
      {} as never,
    );

    expect(result?.content).toEqual([{ type: "text", text: "installed lodash" }]);
  });
});
