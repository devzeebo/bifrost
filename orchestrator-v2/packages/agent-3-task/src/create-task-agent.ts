import type { AgentDefinition } from "@bifrost-ai/engine";
import type { DataRegistry, ScriptFn } from "@bifrost-ai/interfaces-work";

import { runTaskAgent } from "./run-task-agent.js";
import type { TaskAgentDataSchema } from "./types.js";

export function createTaskAgent(agent: AgentDefinition, _name: string): ScriptFn {
  return async (workItem, ctx) =>
    runTaskAgent(
      workItem,
      {
        data: ctx.data as DataRegistry<Pick<TaskAgentDataSchema, "engine">>,
        setState: ctx.setState,
      },
      agent,
    );
}
