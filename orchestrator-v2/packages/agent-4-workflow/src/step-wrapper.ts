import type { DecoratorFn, ScriptContext, WorkItemResult } from "@bifrost-ai/interfaces-work";

import { parseStepOutput } from "./step-result.js";
import type { StepResult } from "./step-result.js";
import type { FlattenedStep, StepWrapperState } from "./types.js";

export function createStepDecorator(_step: FlattenedStep): DecoratorFn {
  return async (workItem, ctx, next) => runStepDecorator(workItem.state, ctx, next);
}

export async function runStepDecorator(
  state: Record<string, unknown>,
  ctx: ScriptContext,
  next: () => Promise<unknown>,
): Promise<WorkItemResult> {
  const parsed = parseStepWrapperState(state);
  if (!parsed.ok) {
    return {
      outcome: "failed",
      message: `Invalid step wrapper state: ${parsed.missing.join(", ")}`,
    };
  }

  const wrapperState = state as StepWrapperState;

  let rawResult: unknown;
  try {
    rawResult = await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return applyStepResult({ transition: "fail", message }, wrapperState, ctx.source);
  }

  const stepOutput = parseStepOutput(rawResult);
  if (stepOutput.kind === "paused") {
    return stepOutput.result;
  }

  return applyStepResult(stepOutput.result, wrapperState, ctx.source);
}

async function applyStepResult(
  result: StepResult,
  state: StepWrapperState,
  source: ScriptContext["source"],
): Promise<WorkItemResult> {
  if (result.transition === "continue") {
    return { outcome: "completed", message: result.message, telemetry: result.telemetry };
  }

  if (result.transition === "rewind") {
    try {
      await source.setState(state.workflowWorkItemId, {
        rewindTarget: result.rewindTo,
        phase: "schedule",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { outcome: "failed", message: `Failed to rewind workflow: ${message}` };
    }

    return { outcome: "failed", message: result.message ?? `Rewinding to ${result.rewindTo}` };
  }

  return { outcome: "failed", message: result.message ?? "fail" };
}

function parseStepWrapperState(
  state: Record<string, unknown>,
): { ok: true } | { ok: false; missing: string[] } {
  const required = ["workflowWorkItemId", "workingDir"] as const;
  const missing: string[] = [];

  for (const field of required) {
    if (!(field in state) || state[field] === undefined) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true };
}
