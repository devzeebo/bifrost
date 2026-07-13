import type { ScriptFn, WorkItem, WorkItemResult } from "@bifrost-ai/interfaces-work";

import type { Runner } from "./runner.js";

export type LegacyScriptFn = (ctx: {
  workItem: WorkItem;
  cwd: string;
  setState: (state: Record<string, unknown>) => Promise<void>;
}) => Promise<WorkItemResult> | WorkItemResult;

export type { ScriptFn };

export function registerScriptAgent<TData extends Record<string, unknown>>(
  runner: Runner<TData>,
  name: string,
  fn: LegacyScriptFn,
): void {
  const script: ScriptFn = async (workItem, ctx) =>
    fn({ workItem, cwd: ctx.cwd, setState: ctx.setState });

  runner.registerScript(name, script);
}
