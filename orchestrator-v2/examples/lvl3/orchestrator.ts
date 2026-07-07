import { Orchestrator } from "@bifrost-ai/orchestrator";
import { type TaskAgentState } from "@bifrost-ai/agent-3-task";
import { type RuneDetail } from "@bifrost-ai/work-item-source-bifrost";

const orchestrator = new Orchestrator();

const bifrost = new BifrostWorkItemSource();

orchestrator.registerWorkItemSource(bifrost);

orchestrator.addWorkItemMapper(
  "task",
  (rune: RuneDetail): Promise<TaskAgentState> =>
    Promise.resolve({
      instructions: rune.description,
      workingDir: rune.state.workingDir,
      engineName: rune.state.engineName,
      sessionId: rune.state.sessionId,
    }),
);

await orchestrator.run();
