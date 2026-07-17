import type { DecoratorFn, ScriptContext } from "@bifrost-ai/interfaces-work";

import { createWorkflowDebug, createWorkflowStepDebug } from "./debug.js";
import { parseStepOutput } from "./step-result.js";
import type { StepResult } from "./step-result.js";
import type { FlattenedStep, StepWrapperState } from "./types.js";

export async function pauseWorkItem(
  ctx: ScriptContext,
  workItemId: string,
  workflowName: string,
): Promise<void> {
  const debug = createWorkflowDebug(workflowName);
  debug("pause workItemId=%s", workItemId);
  await ctx.workItemSource.pauseWorkItem(workItemId);
}

export function createStepDecorator(step: FlattenedStep, workflowName: string): DecoratorFn {
  const debug = createWorkflowStepDebug(workflowName, step.id);
  return async (workItem, ctx, next) =>
    runStepDecorator(workItem.workItemId, workItem.state, ctx, next, debug, workflowName);
}

export async function runStepDecorator(
  workItemId: string,
  state: Record<string, unknown>,
  ctx: ScriptContext,
  next: () => Promise<unknown>,
  debug: ReturnType<typeof createWorkflowStepDebug>,
  workflowName: string,
): Promise<void> {
  verifyStepWrapperState(state);

  debug("run workItemId=%s workflowWorkItemId=%s", workItemId, state.workflowWorkItemId);

  let rawResult: unknown;
  try {
    rawResult = await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug("error workItemId=%s message=%s", workItemId, message);
    await applyStepResult({ transition: "fail", message }, workItemId, ctx, debug, workflowName);
    return;
  }

  const result = parseStepOutput(rawResult);
  debug("result workItemId=%s transition=%s", workItemId, result.transition);
  await applyStepResult(result, workItemId, ctx, debug, workflowName);
}

async function applyStepResult(
  result: StepResult,
  workItemId: string,
  ctx: ScriptContext,
  debug: ReturnType<typeof createWorkflowStepDebug>,
  workflowName: string,
): Promise<void> {
  if (result.transition === "continue") {
    return;
  }

  if (result.transition === "pause") {
    debug("pause workItemId=%s", workItemId);
    await pauseWorkItem(ctx, workItemId, workflowName);
    return;
  }

  debug("fail workItemId=%s message=%s", workItemId, result.message ?? "fail");
  throw new Error(result.message ?? "fail");
}

function verifyStepWrapperState(state: Record<string, unknown>): asserts state is StepWrapperState {
  const required = ["workflowWorkItemId", "workingDir"] as const;
  const missing: string[] = [];

  for (const field of required) {
    if (!(field in state) || state[field] === undefined) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Invalid step wrapper state: ${missing.join(", ")}`);
  }
}
