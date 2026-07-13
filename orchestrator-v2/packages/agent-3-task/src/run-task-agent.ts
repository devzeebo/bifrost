import type { AgentDefinition } from "@bifrost-ai/engine";
import type { DataRegistry, WorkItem } from "@bifrost-ai/interfaces-work";

import { ENGINE_DATA_TYPE, verifyIsTaskAgentState, type TaskAgentDataSchema } from "./types.js";

type TaskAgentContext = {
  data: DataRegistry<Pick<TaskAgentDataSchema, "engine">>;
  setState: (state: Record<string, unknown>) => Promise<void>;
};

export async function runTaskAgent(
  workItem: WorkItem,
  ctx: TaskAgentContext,
  agent: AgentDefinition,
): Promise<void> {
  verifyIsTaskAgentState(workItem.state);

  const { workingDir, instructions, engineName, sessionId } = workItem.state;

  const engine = ctx.data.get(ENGINE_DATA_TYPE).get(engineName);
  if (engine === undefined) {
    throw new Error(`Unknown engine: ${engineName}`);
  }

  const engineResult = await engine.execute(
    {
      workItemId: workItem.workItemId,
      workingDir,
      agent,
      instructions,
      state: workItem.state,
      metadata: workItem.metadata,
      setState: ctx.setState,
    },
    sessionId,
  );

  if (!engineResult.success) {
    throw new Error(engineResult.lastMessage ?? "Engine execution failed");
  }

  if (engineResult.sessionId !== undefined) {
    await ctx.setState({
      ...workItem.state,
      sessionId: engineResult.sessionId,
    });
  }
}
