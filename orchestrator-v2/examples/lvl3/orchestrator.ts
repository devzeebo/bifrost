import { Orchestrator } from "@bifrost-ai/orchestrator";
import { type TaskAgentState } from "@bifrost-ai/agent-3-task";
import { BifrostWorkItemSource, type RuneDetail } from "@bifrost-ai/work-item-source-bifrost";

export const orchestrator = new Orchestrator();

orchestrator.registerWorkItemSource(new BifrostWorkItemSource());

orchestrator.addWorkItemMapper("task", (workItem) => {
  const rune = workItem.metadata as RuneDetail;
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
});
