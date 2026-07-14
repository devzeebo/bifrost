import { type TaskAgentState } from "@bifrost-ai/agent-3-task";
import type { WorkItemMapper } from "@bifrost-ai/orchestrator";
import { type RuneDetail } from "@bifrost-ai/work-item-source-bifrost";

function requireStringField(state: Record<string, unknown>, field: string): string {
  const value = state[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Task work item state is missing required field: ${field}`);
  }
  return value;
}

export const mapTaskWorkItem: WorkItemMapper<RuneDetail> = (workItem) => {
  const rune = workItem.metadata;
  const workingDir = requireStringField(workItem.state, "workingDir");
  const engineName = requireStringField(workItem.state, "engineName");
  const sessionId = workItem.state.sessionId;
  if (sessionId !== undefined && typeof sessionId !== "string") {
    throw new Error("Task work item state has invalid sessionId");
  }

  return {
    ...workItem,
    state: {
      ...workItem.state,
      instructions: rune.description,
      workingDir,
      engineName,
      sessionId,
    } satisfies TaskAgentState,
  };
};
