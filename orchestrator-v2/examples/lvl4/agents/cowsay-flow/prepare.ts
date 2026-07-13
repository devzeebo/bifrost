import { continueStep } from "@bifrost-ai/agent-4-workflow";
import type { WorkflowScriptFn } from "@bifrost-ai/agent-4-workflow";

export const prepare: WorkflowScriptFn = async ({ cwd }) => {
  console.log(`preparing workflow in ${cwd}`);
  return continueStep("prepared");
};
