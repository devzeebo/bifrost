import { continueStep } from "@bifrost-ai/agent-4-workflow";
import type { WorkflowScriptFn } from "@bifrost-ai/agent-4-workflow";

export const summarize: WorkflowScriptFn = async ({ workItem }) => {
  console.log(`workflow ${workItem.workItemId} finished the cowsay step`);
  return continueStep("summarized");
};
