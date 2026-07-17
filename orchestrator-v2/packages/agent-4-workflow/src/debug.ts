import type { WorkItem } from "@bifrost-ai/interfaces-work";
import createDebug, { type Debugger } from "debug";

const WORKFLOW_NAMESPACE = "bifrost:workflow";

export function createWorkflowDebug(workflowName: string): Debugger {
  return createDebug(`${WORKFLOW_NAMESPACE}:${workflowName}`);
}

export function createWorkflowStepDebug(workflowName: string, stepId: string): Debugger {
  return createDebug(`${WORKFLOW_NAMESPACE}:${workflowName}:step:${stepId}`);
}

export function getWorkflowNameFromWorkItem(workItem: WorkItem): string {
  const workflowName = workItem.metadata.workflowName;
  if (typeof workflowName !== "string" || workflowName.length === 0) {
    throw new Error("Work item missing metadata.workflowName");
  }
  return workflowName;
}
