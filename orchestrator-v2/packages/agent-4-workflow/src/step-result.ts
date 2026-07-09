import type { ExecutionStats, WorkItemResult } from "@bifrost-ai/interfaces-work";

export type StepResult =
  | { transition: "continue"; message?: string; telemetry?: ExecutionStats }
  | { transition: "fail"; message?: string }
  | { transition: "rewind"; rewindTo: string; message?: string };

export function continueStep(message?: string, telemetry?: ExecutionStats): StepResult {
  return { transition: "continue", message, telemetry };
}

export function failStep(message?: string): StepResult {
  return { transition: "fail", message };
}

export function rewindStep(rewindTo: string, message?: string): StepResult {
  return { transition: "rewind", rewindTo, message };
}

export function isStepResult(value: unknown): value is StepResult {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const transition = (value as StepResult).transition;
  if (transition === "continue" || transition === "fail") {
    return true;
  }

  if (transition === "rewind") {
    return typeof (value as { rewindTo?: unknown }).rewindTo === "string";
  }

  return false;
}

function isWorkItemResult(value: unknown): value is WorkItemResult {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const outcome = (value as WorkItemResult).outcome;
  return outcome === "completed" || outcome === "failed" || outcome === "paused";
}

export type ParsedStepOutput =
  | { kind: "paused"; result: WorkItemResult }
  | { kind: "transition"; result: StepResult };

export function parseStepOutput(result: unknown): ParsedStepOutput {
  if (isWorkItemResult(result) && result.outcome === "paused") {
    return { kind: "paused", result };
  }

  if (isStepResult(result)) {
    return { kind: "transition", result };
  }

  if (isWorkItemResult(result)) {
    if (result.outcome === "completed") {
      return {
        kind: "transition",
        result: { transition: "continue", message: result.message, telemetry: result.telemetry },
      };
    }

    return {
      kind: "transition",
      result: { transition: "fail", message: result.message },
    };
  }

  return {
    kind: "transition",
    result: { transition: "fail", message: "Invalid step result" },
  };
}
