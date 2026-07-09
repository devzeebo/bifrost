import type { ScriptFn } from "@bifrost-ai/runner";

export type TaskRef = {
  type: "task";
  name: string;
};

export type ScriptRef = {
  type: "script";
  fn: ScriptFn;
  displayName: string;
};

export type WorkflowStepInput = TaskRef | ScriptRef;

export function task(name: string): TaskRef {
  return { type: "task", name };
}

export function script(fn: ScriptFn, displayName?: string): ScriptRef {
  return {
    type: "script",
    fn,
    displayName: displayName ?? (fn.name || "anonymous"),
  };
}
