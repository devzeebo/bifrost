import type { ScriptFn } from "@bifrost-ai/runner";

export const doSomething: ScriptFn = ({ cwd, workItem }) => {
  console.log(`the cwd is ${cwd} for task ${JSON.stringify(workItem.state)}`);
  return { outcome: "completed" };
};
