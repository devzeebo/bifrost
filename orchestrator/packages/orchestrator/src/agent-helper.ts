import { promises as fs } from "node:fs";
import { parseAgentDefinition } from "./core/agent-parser";
import type { Agent } from "./orchestrator-class";

export const loadAgent = async (agent: Agent, definitionPath: string): Promise<void> => {
  const content = await fs.readFile(definitionPath, "utf-8");
  const definition = parseAgentDefinition(content);
  if (!definition) {
    throw new Error(`Failed to parse agent definition from ${definitionPath}`);
  }
  agent.definition = definition;
};
