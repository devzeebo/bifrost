import type { ScriptFn } from "@bifrost-ai/interfaces-work";

import { runWorkflowAgent } from "./run-workflow-agent.js";
import type { WorkflowDefinition } from "./types.js";

export function createWorkflowScript(definition: WorkflowDefinition): ScriptFn {
  return async (workItem, ctx) => runWorkflowAgent(workItem, ctx, definition);
}
