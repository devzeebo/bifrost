import createDebug, { type Debugger } from "debug";

const WORKFLOW_NAMESPACE = "bifrost:workflow";

export function createWorkflowDebug(workflowName: string): Debugger {
  return createDebug(`${WORKFLOW_NAMESPACE}:${workflowName}`);
}

export function createWorkflowStepDebug(workflowName: string, stepId: string): Debugger {
  return createDebug(`${WORKFLOW_NAMESPACE}:${workflowName}:step:${stepId}`);
}
