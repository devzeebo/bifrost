import type { AgentDefinition } from "@bifrost-ai/engine";
import type { MutableDataRegistry, WorkItemHandler } from "@bifrost-ai/interfaces-work";

import { createTaskAgent } from "./create-task-agent.js";
import { AGENT_DEFINITION_DATA_TYPE } from "./types.js";
import type { TaskAgentDataSchema } from "./types.js";

export type TaskAgentRunner = {
  data: MutableDataRegistry<Pick<TaskAgentDataSchema, "agentDefinition">>;
  registerWorkItemHandler(handler: WorkItemHandler): void;
};

export function enrollTaskAgent(runner: TaskAgentRunner, agent: AgentDefinition): void {
  runner.data.get(AGENT_DEFINITION_DATA_TYPE).register(agent.name, agent);
  runner.registerWorkItemHandler(createTaskAgent(agent));
}
