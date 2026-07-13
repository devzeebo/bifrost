import type { DecoratorFn, ScriptContext } from "@bifrost-ai/interfaces-work";

import { parseStepOutput } from "./step-result.js";
import type { StepResult } from "./step-result.js";
import type { FlattenedStep, StepWrapperState } from "./types.js";

export async function pauseWorkItem(ctx: ScriptContext, workItemId: string): Promise<void> {
  await ctx.workItemSource.pauseWorkItem(workItemId);
}

export function createStepDecorator(_step: FlattenedStep): DecoratorFn {
  return async (workItem, ctx, next) =>
    runStepDecorator(workItem.workItemId, workItem.state, ctx, next);
}

export async function runStepDecorator(
  workItemId: string,
  state: Record<string, unknown>,
  ctx: ScriptContext,
  next: () => Promise<unknown>,
): Promise<void> {
  verifyStepWrapperState(state);

  const wrapperState = state as StepWrapperState;

  const rawResult = await next();
  await applyStepResult(parseStepOutput(rawResult), workItemId, wrapperState, ctx);
}

async function applyStepResult(
  result: StepResult,
  workItemId: string,
  state: StepWrapperState,
  ctx: ScriptContext,
): Promise<void> {
  if (result.transition === "continue") {
    return;
  }

  if (result.transition === "pause") {
    await pauseWorkItem(ctx, workItemId);
    return;
  }

  if (result.transition === "rewind") {
    await ctx.workItemSource.setState(state.workflowWorkItemId, {
      rewindTarget: result.rewindTo,
      phase: "schedule",
    });
    throw new Error(result.message ?? `Rewinding to ${result.rewindTo}`);
  }

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
