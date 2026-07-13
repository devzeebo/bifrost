import type { ScriptContext, WorkItem } from "@bifrost-ai/interfaces-work";

import { pauseWorkItem } from "./step-wrapper.js";
import type { WorkflowDefinition, WorkflowState } from "./types.js";
import { verifyIsWorkflowState } from "./types.js";

export async function runWorkflowAgent(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
): Promise<void> {
  verifyIsWorkflowState(workItem.state);

  const state = workItem.state;

  if (state.definitionName !== definition.name) {
    throw new Error(
      `Workflow definition mismatch: expected ${definition.name}, got ${state.definitionName}`,
    );
  }

  const phase = state.phase ?? "schedule";
  if (phase === "schedule") {
    await schedulePass(workItem, ctx, definition, state);
    return;
  }

  await verifyPass(workItem, ctx, definition, state);
}

async function schedulePass(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
  state: WorkflowState,
): Promise<void> {
  const childIds = state.childIds ?? {};

  if (Object.keys(childIds).length === 0) {
    for (const step of definition.steps) {
      if (childIds[step.id] !== undefined) {
        continue;
      }

      const childId = await ctx.workItemSource.createDraftWorkItem({
        kind: step.innerKind,
        name: step.innerName,
        flow: [step.id],
        state: {
          workflowWorkItemId: workItem.workItemId,
          workingDir: state.workingDir,
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
        throw new Error(`Missing child for step ${step.id}`);
      }

      for (const depStepId of step.dependsOn) {
        const depChildId = childIds[depStepId];
        if (depChildId === undefined) {
          throw new Error(`Missing dependency child for ${depStepId}`);
        }
        await ctx.workItemSource.setDependency(childId, depChildId);
      }
    }

    for (const step of definition.steps) {
      const childId = childIds[step.id];
      if (childId !== undefined) {
        await ctx.workItemSource.startWorkItem(childId);
        await ctx.workItemSource.setDependency(workItem.workItemId, childId);
      }
    }
  }

  await ctx.setState({
    ...workItem.state,
    phase: "verify",
    childIds,
  });

  await pauseWorkItem(ctx, workItem.workItemId);
}

async function verifyPass(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
  state: WorkflowState,
): Promise<void> {
  const childIds = state.childIds;
  if (childIds === undefined || Object.keys(childIds).length === 0) {
    throw new Error("Workflow verify pass missing childIds");
  }

  for (const step of definition.steps) {
    const childId = childIds[step.id];
    if (childId === undefined) {
      throw new Error(`Missing child id for step ${step.id}`);
    }

    const status = await ctx.workItemSource.getWorkItemStatus(childId);
    if (status === "failed") {
      throw new Error(`Step ${step.id} failed`);
    }
    if (status !== "completed") {
      await pauseWorkItem(ctx, workItem.workItemId);
      return;
    }
  }
}
