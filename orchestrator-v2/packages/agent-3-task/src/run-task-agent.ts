import type { AgentDefinition } from "@bifrost-ai/engine";
import type {
  WorkItem,
  WorkItemExecutionContext,
  WorkItemResult,
} from "@bifrost-ai/interfaces-work";

import {
  ENGINE_DATA_TYPE,
  missingFieldsMessage,
  parseTaskAgentState,
  type TaskAgentDataSchema,
} from "./types.js";

export async function runTaskAgent(
  workItem: WorkItem,
  ctx: WorkItemExecutionContext<Pick<TaskAgentDataSchema, "engine">>,
  agent: AgentDefinition,
): Promise<WorkItemResult> {
  const parsed = parseTaskAgentState(workItem.state);
  if (!parsed.ok) {
    return { outcome: "failed", message: missingFieldsMessage(parsed.missing) };
  }

  const { workingDir, instructions, engineName, sessionId } = parsed.state;

  const engine = ctx.data.get(ENGINE_DATA_TYPE).get(engineName);
  if (engine === undefined) {
    return { outcome: "failed", message: `Unknown engine: ${engineName}` };
  }

  let engineResult;
  try {
    engineResult = await engine.execute(
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "failed", message };
  }

  // Persist the sessionId before branching on the outcome, so a failed run stays
  // resumable — a retry can --resume instead of rebuilding context from scratch.
  if (engineResult.sessionId !== undefined) {
    await ctx.setState({
      ...workItem.state,
      sessionId: engineResult.sessionId,
    });
  }

  if (!engineResult.success) {
    return {
      outcome: "failed",
      message: engineResult.lastMessage ?? "Engine execution failed",
      telemetry: engineResult.stats ?? undefined,
    };
  }

  return {
    outcome: "completed",
    message: engineResult.lastMessage ?? undefined,
    telemetry: engineResult.stats ?? undefined,
  };
}
