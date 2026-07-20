import type { ToolkitDefinition } from "@bifrost-ai/engine";

const testToolkit: ToolkitDefinition = {
  name: "testtoolkit",
  version: "1.0.0",
  tools: [
    {
      name: "echo",
      description: "echo",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
        required: ["message"],
      },
      execute: async (args) => ({
        content: [{ type: "text", text: String(args.message) }],
      }),
    },
  ],
};

export default testToolkit;
