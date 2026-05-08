#!/usr/bin/env node

import type { AgentDefinition } from "@orchestrator/core";

export type AgentDisplayInfo = {
  name: string;
  description?: string;
  model?: string;
  tools?: string[];
  hooks?: {
    Start: { name: string }[];
    Stop: { name: string }[];
  };
};

/**
 * List available agents in human-readable format.
 * US-9: Developer - List Available Agents
 */
export const listAgents = async (agents: AgentDisplayInfo[]): Promise<string> => {
  if (agents.length === 0) {
    return "No agents found.";
  }

  const lines: string[] = [];

  for (const agent of agents) {
    lines.push(`Agent: ${agent.name}`);

    if (agent.description) {
      lines.push(`  Description: ${agent.description}`);
    }

    if (agent.model) {
      lines.push(`  Model: ${agent.model}`);
    }

    if (agent.tools && agent.tools.length > 0) {
      lines.push(`  Tools: ${agent.tools.join(", ")}`);
    }

    if (agent.hooks?.Start && agent.hooks.Start.length > 0) {
      const startHooks = agent.hooks.Start.map((h) => h.name).join(", ");
      lines.push(`  Start Hooks: ${startHooks}`);
    }

    if (agent.hooks?.Stop && agent.hooks.Stop.length > 0) {
      const stopHooks = agent.hooks.Stop.map((h) => h.name).join(", ");
      lines.push(`  Stop Hooks: ${stopHooks}`);
    }

    lines.push(""); // Blank line between agents
  }

  return lines.join("\n");
};

export function run() {
  console.log("Orchestrator CLI");
}

export * from "./git-root.js";
export * from "./config.js";
