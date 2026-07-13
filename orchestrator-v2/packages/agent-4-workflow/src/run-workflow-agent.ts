import type { ScriptContext, WorkItem, WorkItemResult } from "@bifrost-ai/interfaces-work";

import type { WorkflowDefinition, WorkflowState } from "./types.js";
import { missingFieldsMessage, parseWorkflowState } from "./types.js";

export async function runWorkflowAgent(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
): Promise<WorkItemResult> {
  const parsed = parseWorkflowState(workItem.state);
  if (!parsed.ok) {
    return { outcome: "failed", message: missingFieldsMessage(parsed.missing) };
  }

  if (parsed.state.definitionName !== definition.name) {
    return {
      outcome: "failed",
      message: `Workflow definition mismatch: expected ${definition.name}, got ${parsed.state.definitionName}`,
    };
  }

  const phase = parsed.state.phase ?? "schedule";
  if (phase === "schedule") {
    return schedulePass(workItem, ctx, definition, parsed.state);
  }

  return verifyPass(ctx, definition, parsed.state);
}

async function schedulePass(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
  state: WorkflowState,
): Promise<WorkItemResult> {
  const childIds = state.childIds ?? {};

  if (Object.keys(childIds).length === 0) {
    for (const step of definition.steps) {
      if (childIds[step.id] !== undefined) {
        continue;
      }

      const childId = await ctx.source.createDraftWorkItem({
        kind: step.innerName,
        flow: [step.id],
        state: {
          workflowWorkItemId: workItem.workItemId,
          workingDir: state.workingDir,
          ...(typeof workItem.state.instructions === "string"
            ? { instructions: workItem.state.instructions }
            : {}),
          ...(typeof workItem.state.engineName === "string"
            ? { engineName: workItem.state.engineName }
            : {}),
        },
        metadata: {
          workflowName: definition.name,
          stepId: step.id,
        },
      });
      childIds[step.id] = childId;
    }

    for (const step of definition.steps) {
      const childId = childIds[step.id];
      if (childId === undefined) {
        return { outcome: "failed", message: `Missing child for step ${step.id}` };
      }

      for (const depStepId of step.dependsOn) {
        const depChildId = childIds[depStepId];
        if (depChildId === undefined) {
          return { outcome: "failed", message: `Missing dependency child for ${depStepId}` };
        }
        await ctx.source.setDependency(childId, depChildId);
      }
    }

    for (const step of definition.steps) {
      const childId = childIds[step.id];
      if (childId !== undefined) {
        await ctx.source.startWorkItem(childId);
        await ctx.source.setDependency(workItem.workItemId, childId);
      }
    }
  }

  await ctx.setState({
    ...workItem.state,
    phase: "verify",
    childIds,
  });

  return { outcome: "paused" };
}

async function verifyPass(
  ctx: ScriptContext,
  definition: WorkflowDefinition,
  state: WorkflowState,
): Promise<WorkItemResult> {
  const childIds = state.childIds;
  if (childIds === undefined || Object.keys(childIds).length === 0) {
    return { outcome: "failed", message: "Workflow verify pass missing childIds" };
  }

  for (const step of definition.steps) {
    const childId = childIds[step.id];
    if (childId === undefined) {
      return { outcome: "failed", message: `Missing child id for step ${step.id}` };
    }

    const status = await ctx.source.getWorkItemStatus(childId);
    if (status === "failed") {
      return { outcome: "failed", message: `Step ${step.id} failed` };
    }
    if (status !== "completed") {
      return {
        outcome: "paused",
        message: `Step ${step.id} not completed (status: ${status})`,
      };
    }
  }

  return { outcome: "completed" };
}
