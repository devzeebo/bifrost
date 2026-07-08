import type { AgentDefinition } from "@bifrost-ai/engine";
import type { WorkItemExecutionContext, WorkItemHandler } from "@bifrost-ai/interfaces-work";

import { runTaskAgent } from "./run-task-agent.js";
import type { TaskAgentDataSchema } from "./types.js";

export function createTaskAgent(agent: AgentDefinition, name: string): WorkItemHandler {
  return {
    kind: "task",
    name,
    async run(workItem, ctx) {
      return runTaskAgent(
        workItem,
        ctx as WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">>,
        agent,
      );
    },
  };
}
