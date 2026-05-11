#!/usr/bin/env node

import { BifrostTaskSource } from "@bifrost-ai/task-source-bifrost";
import { ClaudeCodeEngine } from "@bifrost-ai/engine-claude-code";
import { orchestrate, parseAgentDefinition } from "@bifrost-ai/core";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { argv, exit } from "node:process";
import { resolveGitRoot } from "./git-root";

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
      const startHooks = agent.hooks.Start.map((hook) => hook.name).join(", ");
      lines.push(`  Start Hooks: ${startHooks}`);
    }

    if (agent.hooks?.Stop && agent.hooks.Stop.length > 0) {
      const stopHooks = agent.hooks.Stop.map((hook) => hook.name).join(", ");
      lines.push(`  Stop Hooks: ${stopHooks}`);
    }

    lines.push(""); // Blank line between agents
  }

  return lines.join("\n");
};

const discoverAgents = async (projectDir: string) => {
  const agentsDir = resolve(projectDir, ".ai");
  const entries = await readdir(agentsDir, { withFileTypes: true });

  const results = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const agentPath = resolve(agentsDir, entry.name, "AGENT.md");
        try {
          const content = await readFile(agentPath, "utf-8");
          const agent = parseAgentDefinition(content);
          return agent ? ([entry.name, agent] as const) : null;
        } catch {
          return null;
        }
      }),
  );

  return new Map(results.filter((result): result is NonNullable<typeof result> => result !== null));
};

const run = async (): Promise<void> => {
  const cwd = argv[2] ?? process.cwd();
  const projectDir = await resolveGitRoot(cwd);

  if (!projectDir) {
    console.error("Not inside a git repository");
    exit(1);
  }

  console.log(`Project: ${projectDir}`);

  const taskSource = new BifrostTaskSource();
  const engine = new ClaudeCodeEngine();
  const agents = await discoverAgents(projectDir);

  if (agents.size === 0) {
    console.error("No agents found in .ai/ directory");
    exit(1);
  }

  console.log(`Agents: ${[...agents.keys()].join(", ")}`);
  console.log("Watching for tasks...");

  for await (const task of taskSource.watchTasks()) {
    const agent = agents.get(task.agentId);
    if (!agent) {
      console.error(`Unknown agent: ${task.agentId}`);
      await taskSource.failTask(task.id, `Unknown agent: ${task.agentId}`);
    } else {
      console.log(`Task ${task.id} → agent ${task.agentId}`);

      const result = await orchestrate({
        task,
        agent,
        taskSource,
        engine,
        projectDir,
      });

      console.log(`Task ${task.id} ${result.outcome}${result.error ? `: ${result.error}` : ""}`);

      if (result.telemetry) {
        console.log(
          `  ${result.telemetry.numTurns} turns, ${result.telemetry.durationMs}ms, $${result.telemetry.totalCostUsd.toFixed(4)}`,
        );
      }
    }
  }
};

export * from "./git-root";
export * from "./config";
export { run };

if (process.argv[1]?.endsWith("index.js")) {
  run().catch((error: unknown) => {
    console.error(error);
    exit(1);
  });
}
