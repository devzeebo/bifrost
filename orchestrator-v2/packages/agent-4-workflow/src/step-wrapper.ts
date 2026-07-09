import type {
  WorkItem,
  WorkItemExecutionContext,
  WorkItemHandler,
  WorkItemResult,
} from "@bifrost-ai/interfaces-work";

import type { FlattenedStep, StepWrapperState, StepTransition } from "./types.js";

const STEP_WRAPPER_KIND = "script";

export function createStepWrapperHandler(step: FlattenedStep): WorkItemHandler {
  return {
    kind: STEP_WRAPPER_KIND,
    name: step.id,
    async run(workItem, ctx) {
      const parsed = parseStepWrapperState(workItem.state);
      if (!parsed.ok) {
        return {
          outcome: "failed",
          message: `Invalid step wrapper state: ${parsed.missing.join(", ")}`,
        };
      }

      const cwd =
        typeof parsed.state.workingDir === "string" && parsed.state.workingDir.length > 0
          ? parsed.state.workingDir
          : process.cwd();

      return runStepWrapper(workItem, cwd, ctx.setState, step, ctx.handlers, ctx.source);
    },
  };
}

export async function runStepWrapper(
  workItem: WorkItem,
  cwd: string,
  setState: WorkItemExecutionContext["setState"],
  step: FlattenedStep,
  handlers?: WorkItemExecutionContext["handlers"],
  source?: WorkItemExecutionContext["source"],
): Promise<WorkItemResult> {
  const parsed = parseStepWrapperState(workItem.state);
  if (!parsed.ok) {
    return {
      outcome: "failed",
      message: `Invalid step wrapper state: ${parsed.missing.join(", ")}`,
    };
  }

  const wrapperState = parsed.state;
  const transition = readTransition(workItem.state);

  if (transition === "rewind" && wrapperState.rewindTo !== undefined && source !== undefined) {
    await source.setState(wrapperState.workflowWorkItemId, {
      rewindTarget: wrapperState.rewindTo,
      phase: "schedule",
    });
    return { outcome: "failed", message: `Rewinding to ${wrapperState.rewindTo}` };
  }

  if (handlers === undefined) {
    return { outcome: "failed", message: "Step wrapper requires handler registry" };
  }

  const innerHandler = handlers.get(wrapperState.innerKind, wrapperState.innerName);
  if (innerHandler === undefined) {
    return {
      outcome: "failed",
      message: `Unknown inner handler: ${wrapperState.innerKind}:${wrapperState.innerName}`,
    };
  }

  const innerWorkItem: WorkItem = {
    workItemId: workItem.workItemId,
    kind: wrapperState.innerKind,
    name: wrapperState.innerName,
    state: {
      workingDir: wrapperState.workingDir || cwd,
      instructions: wrapperState.instructions ?? "",
      engineName: wrapperState.engineName ?? "",
    },
    metadata: workItem.metadata,
  };

  const innerCtx: WorkItemExecutionContext = {
    data: { get: () => ({ get: () => undefined, has: () => false, register: () => {} }) },
    handlers,
    source: source ?? noopSource(),
    setState,
  };

  let result: WorkItemResult;
  try {
    result = await innerHandler.run(innerWorkItem, innerCtx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return mapTransition("fail", message);
  }

  if (result.outcome === "failed") {
    return mapTransition(transition === "rewind" ? "rewind" : "fail", result.message);
  }

  if (result.outcome === "paused") {
    return result;
  }

  return mapTransition("success", result.message, result.telemetry);
}

function mapTransition(
  transition: StepTransition,
  message?: string,
  telemetry?: WorkItemResult["telemetry"],
): WorkItemResult {
  if (transition === "success") {
    return { outcome: "completed", message, telemetry };
  }
  return { outcome: "failed", message: message ?? transition };
}

function readTransition(state: Record<string, unknown>): StepTransition {
  const value = state.transition;
  if (value === "fail" || value === "rewind") {
    return value;
  }
  return "success";
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

  const rewindTo = state.rewindTo;
  if (rewindTo !== undefined && typeof rewindTo !== "string") {
    missing.push("rewindTo");
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
      ...(typeof rewindTo === "string" ? { rewindTo } : {}),
    },
  };
}

function noopSource(): WorkItemExecutionContext["source"] {
  return {
    async createDraftWorkItem() {
      throw new Error("not implemented");
    },
    async startWorkItem() {
      throw new Error("not implemented");
    },
    async setDependency() {
      throw new Error("not implemented");
    },
    async getDependencies() {
      return [];
    },
    async getWorkItemStatus() {
      return "live";
    },
    async setState() {
      throw new Error("not implemented");
    },
  };
}

export { STEP_WRAPPER_KIND };
