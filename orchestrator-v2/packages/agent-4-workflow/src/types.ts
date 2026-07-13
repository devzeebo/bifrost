import type { ExecutionStats } from "@bifrost-ai/interfaces-work";

export type WorkflowPhase = "schedule" | "verify";

export type StepTransition = "continue" | "fail" | "rewind";

export type FlattenedStep = {
  id: string;
  innerKind: "task" | "script";
  innerName: string;
  dependsOn: string[];
};

export type WorkflowDefinition = {
  name: string;
  steps: FlattenedStep[];
};

export type WorkflowState = {
  workingDir: string;
  definitionName: string;
  phase?: WorkflowPhase;
  childIds?: Record<string, string>;
  rewindTarget?: string;
};

export type StepWrapperState = {
  workflowWorkItemId: string;
  workingDir: string;
};

export type WorkflowStateParseResult = { ok: true } | { ok: false; missing: string[] };

export function parseWorkflowState(taskState: Record<string, unknown>): WorkflowStateParseResult {
  const missing: string[] = [];

  const workingDir = taskState.workingDir;
  if (typeof workingDir !== "string" || workingDir.length === 0) {
    missing.push("workingDir");
  }

  const definitionName = taskState.definitionName;
  if (typeof definitionName !== "string" || definitionName.length === 0) {
    missing.push("definitionName");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const phase = taskState.phase;
  const childIds = taskState.childIds;
  const rewindTarget = taskState.rewindTarget;

  if (phase !== undefined && phase !== "schedule" && phase !== "verify") {
    missing.push("phase");
  }
  if (
    childIds !== undefined &&
    (childIds === null || typeof childIds !== "object" || Array.isArray(childIds))
  ) {
    missing.push("childIds");
  }
  if (rewindTarget !== undefined && typeof rewindTarget !== "string") {
    missing.push("rewindTarget");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true };
}

export function missingFieldsMessage(missing: string[]): string {
  return `Workflow agent state is missing required fields: ${missing.join(", ")}`;
}

export function aggregateTelemetry(
  telemetryList: Array<ExecutionStats | undefined>,
): ExecutionStats | undefined {
  const present = telemetryList.filter((stats): stats is ExecutionStats => stats !== undefined);
  if (present.length === 0) {
    return undefined;
  }

  return present.reduce(
    (total, stats) => ({
      durationMs: total.durationMs + stats.durationMs,
      inputTokens: total.inputTokens + stats.inputTokens,
      outputTokens: total.outputTokens + stats.outputTokens,
      cacheReadTokens: total.cacheReadTokens + stats.cacheReadTokens,
      cacheCreationTokens: total.cacheCreationTokens + stats.cacheCreationTokens,
      totalCostUsd: total.totalCostUsd + stats.totalCostUsd,
      numTurns: total.numTurns + stats.numTurns,
    }),
    {
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalCostUsd: 0,
      numTurns: 0,
    },
  );
}
