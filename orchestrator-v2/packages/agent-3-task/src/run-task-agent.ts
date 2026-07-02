import type { ScriptContext, ScriptResult } from "@bifrost-ai/interfaces-task";

import type { TaskAgentConfig } from "./types.js";
import { missingFieldsMessage, parseTaskAgentState } from "./types.js";

export async function runTaskAgent(
  ctx: ScriptContext,
  config: TaskAgentConfig,
): Promise<ScriptResult> {
  const parsed = parseTaskAgentState(ctx.taskState);
  if (!parsed.ok) {
    return { outcome: "failed", message: missingFieldsMessage(parsed.missing) };
  }

  const { workingDir, instructions, sessionId } = parsed.state;

  let engineResult;
  try {
    engineResult = await config.engine.execute(
      {
        taskId: ctx.taskId,
        workingDir,
        agent: config.agent,
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

  if (!engineResult.success) {
    return {
      outcome: "failed",
      message: engineResult.lastMessage ?? "Engine execution failed",
    };
  }

  if (engineResult.sessionId !== undefined) {
    await ctx.setState({
      ...ctx.taskState,
      sessionId: engineResult.sessionId,
    });
  }

  return {
    outcome: "completed",
    message: engineResult.lastMessage ?? undefined,
    telemetry: engineResult.stats ?? undefined,
  };
}
