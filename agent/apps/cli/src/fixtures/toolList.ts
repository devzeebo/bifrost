import { defineTool } from "@agent/tools";

const echo = defineTool({
  name: "echo",
  description: "Echoes text",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: () => "ok",
});

export default [echo];
