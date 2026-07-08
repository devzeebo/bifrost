import type {
  WorkItem,
  WorkItemExecutionContext,
  WorkItemHandler,
  WorkItemResult,
} from "@bifrost-ai/interfaces-work";

export type ScriptFn = (ctx: {
  workItem: WorkItem;
  cwd: string;
  setState: WorkItemExecutionContext["setState"];
}) => Promise<WorkItemResult> | WorkItemResult;

export function createScriptAgent(fn: ScriptFn, name: string): WorkItemHandler {
  return {
    kind: "script",
    name,
    async run(workItem, ctx) {
      const cwd =
        typeof workItem.state.workingDir === "string" && workItem.state.workingDir.length > 0
          ? workItem.state.workingDir
          : process.cwd();
      return fn({ workItem, cwd, setState: ctx.setState });
    },
  };
}
