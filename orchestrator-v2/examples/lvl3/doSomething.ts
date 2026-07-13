import type { ScriptFn } from "@bifrost-ai/runner";

export const doSomething: ScriptFn = async (workItem, ctx) => {
  console.log(`the cwd is ${ctx.cwd} for task ${JSON.stringify(workItem.state)}`);
  return { outcome: "completed" };
};
