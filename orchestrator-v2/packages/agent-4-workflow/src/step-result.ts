import type { ExecutionStats } from "@bifrost-ai/interfaces-work";

export type StepResult =
  | { transition: "continue"; message?: string; telemetry?: ExecutionStats }
  | { transition: "fail"; message?: string }
  | { transition: "pause" };

export function continueStep(message?: string, telemetry?: ExecutionStats): StepResult {
  return { transition: "continue", message, telemetry };
}

export function failStep(message?: string): StepResult {
  return { transition: "fail", message };
}

export function pauseStep(): StepResult {
  return { transition: "pause" };
}

export function isStepResult(value: unknown): value is StepResult {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const transition = (value as StepResult).transition;
  return transition === "continue" || transition === "fail" || transition === "pause";
}

export function parseStepOutput(result: unknown): StepResult {
  if (isStepResult(result)) {
    return result;
  }

  return { transition: "fail", message: "Invalid step result" };
}
