import type { WorkItemExecutionContext, WorkItemHandler } from "@bifrost-ai/interfaces-work";

import { runWorkflowAgent } from "./run-workflow-agent.js";
import type { WorkflowDefinition } from "./types.js";

export function createWorkflowAgent(definition: WorkflowDefinition, name: string): WorkItemHandler {
  return {
    kind: "workflow",
    name,
    async run(workItem, ctx) {
      return runWorkflowAgent(workItem, ctx as WorkItemExecutionContext, definition);
    },
  };
}
