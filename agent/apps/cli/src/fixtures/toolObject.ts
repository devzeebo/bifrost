import { defineTool } from "@agent/tools";

const ping = defineTool({
  name: "ping",
  description: "Replies with pong",
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  execute: () => "pong",
});

export default { tools: [ping] };
