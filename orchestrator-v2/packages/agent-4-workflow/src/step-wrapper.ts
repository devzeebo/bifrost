import type {
  WorkItem,
  WorkItemExecutionContext,
  WorkItemHandler,
  WorkItemResult,
} from "@bifrost-ai/interfaces-work";

import { parseStepOutput } from "./step-result.js";
import type { StepResult } from "./step-result.js";
import type { FlattenedStep, StepWrapperState } from "./types.js";

const STEP_WRAPPER_KIND = "script";

export function createStepWrapperHandler(step: FlattenedStep): WorkItemHandler {
  return {
    kind: STEP_WRAPPER_KIND,
    name: step.id,
    async run(workItem, ctx) {
      return runStepWrapper(workItem, ctx);
    },
  };
}

export async function runStepWrapper(
  workItem: WorkItem,
  ctx: WorkItemExecutionContext,
  wrapperState?: StepWrapperState,
): Promise<WorkItemResult> {
  const parsed =
    wrapperState !== undefined
      ? { ok: true as const, state: wrapperState }
      : parseStepWrapperState(workItem.state);
  if (!parsed.ok) {
    return {
      outcome: "failed",
      message: `Invalid step wrapper state: ${parsed.missing.join(", ")}`,
    };
  }

  const state = parsed.state;
  const innerHandler = ctx.handlers.get(state.innerKind, state.innerName);
  if (innerHandler === undefined) {
    return {
      outcome: "failed",
      message: `Unknown inner handler: ${state.innerKind}:${state.innerName}`,
    };
  }

  const cwd =
    typeof state.workingDir === "string" && state.workingDir.length > 0
      ? state.workingDir
      : process.cwd();

  const innerWorkItem: WorkItem = {
    workItemId: workItem.workItemId,
    kind: state.innerKind,
    name: state.innerName,
    state: {
      workingDir: cwd,
      instructions: state.instructions ?? "",
      engineName: state.engineName ?? "",
    },
    metadata: workItem.metadata,
  };

  let rawResult: unknown;
  try {
    rawResult = await innerHandler.run(innerWorkItem, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return applyStepResult({ transition: "fail", message }, state, ctx.source);
  }

  const stepOutput = parseStepOutput(rawResult);
  if (stepOutput.kind === "paused") {
    return stepOutput.result;
  }

  return applyStepResult(stepOutput.result, state, ctx.source);
}

async function applyStepResult(
  result: StepResult,
  state: StepWrapperState,
  source: WorkItemExecutionContext["source"],
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
): { ok: true; state: StepWrapperState } | { ok: false; missing: string[] } {
  const required = [
    "stepId",
    "workflowWorkItemId",
    "innerKind",
    "innerName",
    "workingDir",
  ] as const;
  const missing: string[] = [];

  for (const field of required) {
    if (!(field in state) || state[field] === undefined) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    state: {
      stepId: state.stepId as string,
      workflowWorkItemId: state.workflowWorkItemId as string,
      innerKind: state.innerKind as "task" | "script",
      innerName: state.innerName as string,
      workingDir: state.workingDir as string,
      ...(typeof state.instructions === "string" ? { instructions: state.instructions } : {}),
      ...(typeof state.engineName === "string" ? { engineName: state.engineName } : {}),
    },
  };
}

export { STEP_WRAPPER_KIND };
