import type { ScriptContext, WorkItem } from "@bifrost-ai/interfaces-work";
import type { Debugger } from "debug";

import { createWorkflowDebug } from "./debug.js";
import { pauseWorkItem } from "./step-wrapper.js";
import type {
  FlattenedStep,
  ScheduleContext,
  ScheduleHook,
  ScheduleHookContext,
  VerifyHook,
  VerifyHookContext,
  WorkflowChildRef,
  WorkflowDefinition,
  WorkflowState,
} from "./types.js";
import { verifyIsWorkflowState } from "./types.js";

export async function runWorkflowAgent(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
): Promise<void> {
  verifyIsWorkflowState(workItem.state);

  const state = workItem.state;
  const debug = createWorkflowDebug(definition.name);

  if (workItem.name !== definition.name) {
    throw new Error(
      `Workflow definition mismatch: expected ${definition.name}, got ${workItem.name}`,
    );
  }

  const phase = state.phase ?? "schedule";
  debug(
    "run workItemId=%s phase=%s stepCount=%d",
    workItem.workItemId,
    phase,
    definition.steps.length,
  );

  if (phase === "schedule") {
    await schedulePass(workItem, ctx, definition, state, debug);
    return;
  }

  await verifyPass(workItem, ctx, definition, state, debug);
}

async function schedulePass(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
  state: WorkflowState,
  debug: Debugger,
): Promise<void> {
  const childIds = { ...state.childIds };
  const hooks = definition.hooks;
  const resuming = Object.keys(childIds).length > 0;

  debug("schedule pass workItemId=%s resuming=%s", workItem.workItemId, resuming);

  if (!resuming) {
    const schedule: ScheduleContext = {
      steps: [...definition.steps],
      childIds,
      draftMetadata: {},
      draftState: {},
    };
    const hookCtx: ScheduleHookContext = {
      workflow: workItem,
      definition,
      schedule,
      ctx,
    };

    debug("resolving steps count=%d", schedule.steps.length);
    schedule.steps = await resolveSteps(
      hooks?.onBeforeCreateStepList,
      hookCtx,
      schedule.steps,
      debug,
    );
    await runScheduleHooks(hooks?.onBeforeDraftChildren, hookCtx, debug, "onBeforeDraftChildren");

    await draftChildren(ctx, workItem, definition, state, schedule, debug);
    await runScheduleHooks(
      hooks?.onBeforeWireDependencies,
      hookCtx,
      debug,
      "onBeforeWireDependencies",
    );

    await wireDependencies(ctx, schedule.steps, schedule.childIds, debug);
    await runScheduleHooks(hooks?.onBeforeStartChildren, hookCtx, debug, "onBeforeStartChildren");

    await startChildren(ctx, workItem.workItemId, schedule.steps, schedule.childIds, debug);
    await runScheduleHooks(hooks?.onAfterStartChildren, hookCtx, debug, "onAfterStartChildren");

    Object.assign(childIds, schedule.childIds);
  }

  debug("transitioning to verify phase childCount=%d", Object.keys(childIds).length);
  await ctx.setState({
    ...workItem.state,
    phase: "verify",
    childIds,
  });

  await pauseWorkItem(ctx, workItem.workItemId, definition.name);
  debug("schedule pass complete workItemId=%s paused", workItem.workItemId);
}

async function resolveSteps(
  hooks: ScheduleHook[] | undefined,
  hookCtx: ScheduleHookContext,
  steps: FlattenedStep[],
  debug: Debugger,
): Promise<FlattenedStep[]> {
  let current = steps;
  for (const [index, hook] of (hooks ?? []).entries()) {
    debug("onBeforeCreateStepList hook=%d steps=%d", index, current.length);
    hookCtx.schedule.steps = current;
    const result = await hook(hookCtx);
    if (Array.isArray(result)) {
      current = result;
      debug("onBeforeCreateStepList hook=%d result steps=%d", index, current.length);
    }
  }
  return current;
}

async function runScheduleHooks(
  hooks: ScheduleHook[] | undefined,
  hookCtx: ScheduleHookContext,
  debug: Debugger,
  hookName: string,
): Promise<void> {
  for (const [index, hook] of (hooks ?? []).entries()) {
    debug("%s hook=%d", hookName, index);
    const result = await hook(hookCtx);
    if (Array.isArray(result)) {
      hookCtx.schedule.steps = result;
      debug("%s hook=%d result steps=%d", hookName, index, result.length);
    }
  }
}

async function runVerifyHooks(
  hooks: VerifyHook[] | undefined,
  hookCtx: VerifyHookContext,
  debug: Debugger,
  hookName: string,
): Promise<void> {
  for (const [index, hook] of (hooks ?? []).entries()) {
    debug("%s hook=%d", hookName, index);
    await hook(hookCtx);
  }
}

async function draftChildren(
  ctx: ScriptContext,
  workItem: WorkItem,
  definition: WorkflowDefinition,
  state: WorkflowState,
  schedule: ScheduleContext,
  debug: Debugger,
): Promise<void> {
  for (const step of schedule.steps) {
    if (schedule.childIds[step.id] !== undefined) {
      debug("draft skip stepId=%s (already drafted)", step.id);
      continue;
    }

    const childId = await ctx.workItemSource.createDraftWorkItem({
      kind: step.innerKind,
      name: step.innerName,
      flow: step.flow,
      state: {
        workflowWorkItemId: workItem.workItemId,
        workingDir: state.workingDir,
        ...schedule.draftState,
      },
      metadata: {
        ...schedule.draftMetadata,
        workflowName: definition.name,
        stepId: step.id,
        parentId: workItem.workItemId,
      },
    });
    schedule.childIds[step.id] = childId;
    debug(
      "drafted stepId=%s childId=%s kind=%s name=%s deps=%o",
      step.id,
      childId,
      step.innerKind,
      step.innerName,
      step.dependsOn,
    );
  }
}

async function wireDependencies(
  ctx: ScriptContext,
  steps: FlattenedStep[],
  childIds: Record<string, string>,
  debug: Debugger,
): Promise<void> {
  for (const step of steps) {
    const childId = childIds[step.id];
    if (childId === undefined) {
      throw new Error(`Missing child for step ${step.id}`);
    }

    for (const depStepId of step.dependsOn) {
      const depChildId = childIds[depStepId];
      if (depChildId === undefined) {
        throw new Error(`Missing dependency child for ${depStepId}`);
      }
      await ctx.workItemSource.setDependency(depChildId, "blocks", childId);
      debug("wired dependency blocker=%s blocked=%s stepId=%s", depChildId, childId, step.id);
    }
  }
}

async function startChildren(
  ctx: ScriptContext,
  workflowWorkItemId: string,
  steps: FlattenedStep[],
  childIds: Record<string, string>,
  debug: Debugger,
): Promise<void> {
  for (const step of steps) {
    const childId = childIds[step.id];
    if (childId !== undefined) {
      await ctx.workItemSource.startWorkItem(childId);
      await ctx.workItemSource.setDependency(childId, "blocks", workflowWorkItemId);
      debug(
        "started childId=%s stepId=%s blocks workflow=%s",
        childId,
        step.id,
        workflowWorkItemId,
      );
    }
  }
}

function buildChildRefs(
  steps: FlattenedStep[],
  childIds: Record<string, string>,
): WorkflowChildRef[] {
  return steps
    .map((step) => {
      const workItemId = childIds[step.id];
      if (workItemId === undefined) {
        return undefined;
      }
      return { stepId: step.id, workItemId, step };
    })
    .filter((child): child is WorkflowChildRef => child !== undefined);
}

async function verifyPass(
  workItem: WorkItem,
  ctx: ScriptContext,
  definition: WorkflowDefinition,
  state: WorkflowState,
  debug: Debugger,
): Promise<void> {
  const childIds = state.childIds;
  if (childIds === undefined || Object.keys(childIds).length === 0) {
    throw new Error("Workflow verify pass missing childIds");
  }

  const children = buildChildRefs(definition.steps, childIds);
  debug("verify pass workItemId=%s childCount=%d", workItem.workItemId, children.length);

  const hookCtx: VerifyHookContext = {
    workflow: workItem,
    definition,
    children,
    ctx,
  };
  await runVerifyHooks(definition.hooks?.onBeforeVerify, hookCtx, debug, "onBeforeVerify");
  await validateChildren(ctx, children, debug);
  await runVerifyHooks(definition.hooks?.onAfterVerify, hookCtx, debug, "onAfterVerify");
  debug("verify pass complete workItemId=%s", workItem.workItemId);
}

async function validateChildren(
  ctx: ScriptContext,
  children: WorkflowChildRef[],
  debug: Debugger,
): Promise<void> {
  for (const child of children) {
    const status = await ctx.workItemSource.getWorkItemStatus(child.workItemId);
    debug("validate stepId=%s childId=%s status=%s", child.stepId, child.workItemId, status);
    if (status === "failed") {
      throw new Error(`Step ${child.stepId} failed`);
    }
    if (status !== "completed") {
      throw new Error(`Step ${child.stepId} is not completed (status: ${status})`);
    }
  }
}
