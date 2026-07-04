import type { AgentDefinition } from "@bifrost-ai/engine";
import type { WorkItemExecutionContext, WorkItemHandler } from "@bifrost-ai/interfaces-work";

import { runTaskAgent } from "./run-task-agent.js";
import type { TaskAgentDataSchema } from "./types.js";

export function createTaskAgent(agent: AgentDefinition): WorkItemHandler {
  return {
    kind: "task",
    name: agent.name,
    async run(workItem, ctx) {
      return runTaskAgent(
        workItem,
        ctx as WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">>,
        agent,
      );
    },
  };
}
