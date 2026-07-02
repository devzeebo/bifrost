import type { AgentDefinition } from "@bifrost-ai/engine";
import type { ScriptContext, ScriptTaskDefinition } from "@bifrost-ai/interfaces-task";

import { runTaskAgent } from "./run-task-agent.js";
import type { TaskAgentDataSchema } from "./types.js";

export function createTaskAgent(agent: AgentDefinition): ScriptTaskDefinition {
  return {
    name: agent.name,
    async run(ctx) {
      return runTaskAgent(ctx as ScriptContext<Pick<TaskAgentDataSchema, "engine">>, agent);
    },
  };
}
