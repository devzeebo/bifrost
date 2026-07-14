import type {
  DecoratorFactory,
  DecoratorFn,
  ScriptContext,
  WorkItem,
} from "@bifrost-ai/interfaces-work";

import { createRetryDecorator, RETRY_DECORATOR } from "./retry.js";
import type { StepResult } from "./step-result.js";

export type StepDecorator =
  | string
  | { name: string; fn: DecoratorFn }
  | { name: string; fn: DecoratorFactory; args: unknown[] };

export function retry(maxAttempts: number): StepDecorator {
  return { name: RETRY_DECORATOR, fn: createRetryDecorator, args: [maxAttempts] };
}

export type TaskRef = {
  type: "task";
  name: string;
  decorators?: StepDecorator[];
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
  decorators?: StepDecorator[];
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
