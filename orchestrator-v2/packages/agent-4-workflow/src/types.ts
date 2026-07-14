import type { DecoratorFn } from "@bifrost-ai/interfaces-work";

export type WorkflowPhase = "schedule" | "verify";

export type StepTransition = "continue" | "fail" | "pause";

export type FlattenedStep = {
  id: string;
  innerKind: "task" | "script";
  innerName: string;
  dependsOn: string[];
  flow: string[];
  decoratorFns?: Record<string, DecoratorFn>;
};

export type WorkflowDefinition = {
  name: string;
  steps: FlattenedStep[];
};

export type WorkflowState = {
  workingDir: string;
  phase?: WorkflowPhase;
  childIds?: Record<string, string>;
};

export type StepWrapperState = {
  workflowWorkItemId: string;
  workingDir: string;
};

export type WorkflowStateParseResult = { ok: true } | { ok: false; missing: string[] };

export function getWorkflowStateMissingFields(taskState: Record<string, unknown>): string[] {
  const missing: string[] = [];

  const workingDir = taskState.workingDir;
  if (typeof workingDir !== "string" || workingDir.length === 0) {
    missing.push("workingDir");
  }

  const phase = taskState.phase;
  const childIds = taskState.childIds;

  if (phase !== undefined && phase !== "schedule" && phase !== "verify") {
    missing.push("phase");
  }
  if (
    childIds !== undefined &&
    (childIds === null || typeof childIds !== "object" || Array.isArray(childIds))
  ) {
    missing.push("childIds");
  }

  return [...new Set(missing)];
}

export function verifyIsWorkflowState(
  taskState: Record<string, unknown>,
): asserts taskState is WorkflowState {
  const missing = getWorkflowStateMissingFields(taskState);
  if (missing.length > 0) {
    throw new Error(missingFieldsMessage(missing));
  }
}

export function parseWorkflowState(taskState: Record<string, unknown>): WorkflowStateParseResult {
  const missing = getWorkflowStateMissingFields(taskState);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true };
}

export function missingFieldsMessage(missing: string[]): string {
  return `Workflow agent state is missing required fields: ${missing.join(", ")}`;
}
