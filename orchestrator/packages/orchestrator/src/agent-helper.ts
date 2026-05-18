import { promises as fs } from "node:fs";
import { parseAgentDefinition } from "./core/agent-parser";
import type { AgentDefinition } from "./core/types";

export const loadAgent = async (agent: AgentDefinition, definitionPath: string): Promise<void> => {
  const content = await fs.readFile(definitionPath, "utf-8");
  const definition = parseAgentDefinition(content);
  if (!definition) {
    throw new Error(`Failed to parse agent definition from ${definitionPath}`);
  }
  Object.assign(agent, definition);
};
