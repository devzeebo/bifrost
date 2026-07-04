import type { AgentDefinition } from "@bifrost-ai/engine";
import type { ScriptContext, ScriptResult } from "@bifrost-ai/interfaces-task";

import {
  ENGINE_DATA_TYPE,
  missingFieldsMessage,
  parseTaskAgentState,
  type TaskAgentDataSchema,
} from "./types.js";

export async function runTaskAgent(
  ctx: ScriptContext<Pick<TaskAgentDataSchema, "engine">>,
  agent: AgentDefinition,
): Promise<ScriptResult> {
  const parsed = parseTaskAgentState(ctx.taskState);
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
        taskId: ctx.taskId,
        workingDir,
        agent,
        instructions,
        taskState: ctx.taskState,
        metadata: ctx.metadata,
        setState: ctx.setState,
      },
      sessionId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "failed", message };
  }

  // Persist the session before branching on outcome: a failed run that produced
  // a session must still be resumable by a retry (the engine may have made
  // progress before failing), and telemetry is reported on both outcomes.
  if (engineResult.sessionId !== undefined) {
    await ctx.setState({
      ...ctx.taskState,
      sessionId: engineResult.sessionId,
    });
  }

  const telemetry = engineResult.stats ?? undefined;

  if (!engineResult.success) {
    return {
      outcome: "failed",
      message: engineResult.lastMessage ?? "Engine execution failed",
      telemetry,
    };
  }

  return {
    outcome: "completed",
    message: engineResult.lastMessage ?? undefined,
    telemetry,
  };
}
