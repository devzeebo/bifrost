import type { ScriptContext, WorkItem } from "@bifrost-ai/interfaces-work";

import type { StepResult } from "./step-result.js";

export type TaskRef = {
  type: "task";
  name: string;
};

export type WorkflowScriptFn = (ctx: {
  workItem: WorkItem;
  cwd: string;
  setState: ScriptContext["setState"];
}) => Promise<StepResult> | StepResult;

export type ScriptRef = {
  type: "script";
  fn: WorkflowScriptFn;
  displayName: string;
};

export type WorkflowStepInput = TaskRef | ScriptRef;

export function task(name: string): TaskRef {
  return { type: "task", name };
}

export function script(fn: WorkflowScriptFn, displayName?: string): ScriptRef {
  return {
    type: "script",
    fn,
    displayName: displayName ?? (fn.name || "anonymous"),
  };
}
