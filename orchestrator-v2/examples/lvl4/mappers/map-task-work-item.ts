import { type TaskAgentState } from "@bifrost-ai/agent-3-task";
import type { WorkItemMapper } from "@bifrost-ai/orchestrator";
import { type RuneDetail } from "@bifrost-ai/work-item-source-bifrost";

export const mapTaskWorkItem: WorkItemMapper<RuneDetail> = (workItem) => {
  const rune = workItem.metadata;
  return {
    ...workItem,
    state: {
      ...workItem.state,
      instructions: rune.description,
      workingDir: workItem.state.workingDir as string,
      engineName: workItem.state.engineName as string,
      sessionId: workItem.state.sessionId as string | undefined,
    } satisfies TaskAgentState,
  };
};
