import type { ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";

import { runTaskAgent } from "./run-task-agent.js";
import type { TaskAgentConfig } from "./types.js";

export function createTaskAgent(config: TaskAgentConfig): ScriptTaskDefinition {
  return {
    name: config.agent.name,
    async run(ctx) {
      return runTaskAgent(ctx, config);
    },
  };
}
