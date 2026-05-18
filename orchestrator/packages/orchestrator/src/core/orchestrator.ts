import type { AgentDefinition, HookExecutionContext } from "./types";
import { validateTaskState } from "./validator";
import type { Task, TaskSource } from "@bifrost-ai/task-source";
import type { Engine, EngineContext, EngineResult } from "@bifrost-ai/engine";
import { executeHooks } from "./hook-executor";

type OrchestrationResult = {
  outcome: "completed" | "failed" | "halted" | "skipped";
  telemetry?: {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    totalCostUsd: number;
    numTurns: number;
  };
  error?: string;
  skipReason?: string;
};

type OrchestrateOptions = {
  task: Task;
  agent: AgentDefinition;
  taskSource: TaskSource;
  engine: Engine;
  projectDir: string;
};

/**
 * Execute the full orchestration lifecycle for a task.
 * FR-14: Orchestration Lifecycle
 * US-3: Agent Operator - Dispatch agent on task
 */
export const orchestrate = async (options: OrchestrateOptions): Promise<OrchestrationResult> => {
  const { task, agent, taskSource, engine, projectDir } = options;

  const startTime = Date.now();
  let totalTelemetry: EngineResult["stats"] = null;
  let numTurns = 0;

  // Step 1: Validate taskState against agent parameter schema
  const validation = validateTaskState(task.taskState, agent.template.parameters);

  if (!validation.valid) {
    await taskSource.failTask(task.id, validation.errors.join("; "));
    return { outcome: "failed", error: validation.errors.join("; ") };
  }

  const setTaskState = async (arg: Record<string, unknown>) => {
    await taskSource.setState(task.id, arg);
  };

  // Step 2: Execute pre-task hooks
  const hookContext: Omit<HookExecutionContext, "hookName"> = {
    projectDir,
    params: task.taskState,
    taskState: task.taskState,
    setTaskState,
  };

  const startHookResults = await executeHooks({
    hooks: agent.hooks.Start,
    lifecycle: "Start",
    context: hookContext,
  });

  for (const hook of startHookResults) {
    if (hook.outcome === "fatal") {
      await taskSource.failTask(task.id, `Start hook failed: ${hook.message ?? "unknown error"}`);
      return { outcome: "failed", error: hook.message };
    }

    if (hook.outcome === "skip") {
      await taskSource.completeTask(task.id);
      return { outcome: "skipped", skipReason: hook.message };
    }
  }

  // Step 3: Invoke engine with setState callback
  const engineContext: EngineContext = {
    taskId: task.id,
    workingDir: projectDir,
    agentName: agent.name,
    taskState: task.taskState,
    metadata: task.metadata,
    setState: (newState: Record<string, unknown>) => taskSource.setState(task.id, newState),
    verbose: false,
  };

  // Main execution loop (handles follow-ups)
  let maxFollowUps = 10;
  let instructions: string | undefined = undefined;
  let sessionId: string | undefined = undefined;

  while ((maxFollowUps -= 1) > 0) {
    numTurns += 1;

    const engineResult: EngineResult = await engine.execute(
      {
        ...engineContext,
        instructions,
      },
      sessionId,
    );

    if (engineResult.stats) {
      if (!totalTelemetry) {
        totalTelemetry = { ...engineResult.stats };
      } else {
        totalTelemetry.durationMs += engineResult.stats.durationMs;
        totalTelemetry.inputTokens += engineResult.stats.inputTokens;
        totalTelemetry.outputTokens += engineResult.stats.outputTokens;
        totalTelemetry.cacheReadTokens += engineResult.stats.cacheReadTokens;
        totalTelemetry.cacheCreationTokens += engineResult.stats.cacheCreationTokens;
        totalTelemetry.totalCostUsd += engineResult.stats.totalCostUsd;
        totalTelemetry.numTurns += engineResult.stats.numTurns;
      }
    }

    ({ sessionId } = engineResult);

    // Step 4: Execute post-task hooks
    const stopHookResults = await executeHooks({
      hooks: agent.hooks.Stop,
      lifecycle: "Stop",
      context: hookContext,
    });

    let needsFollowUp = false;
    let followUpMessage = "";

    for (const hook of stopHookResults) {
      if (hook.outcome === "fatal") {
        await taskSource.failTask(task.id, `Stop hook failed: ${hook.message ?? "unknown error"}`);
        return { outcome: "failed", error: hook.message };
      }

      if (hook.outcome === "follow-up") {
        needsFollowUp = true;
        followUpMessage = hook.message ?? "";
        break;
      }
    }

    if (!needsFollowUp) {
      break;
    }

    instructions = followUpMessage;
  }

  // Step 5: Report success
  await taskSource.completeTask(task.id);

  const durationMs = Date.now() - startTime;

  return {
    outcome: "completed",
    telemetry: totalTelemetry
      ? {
          ...totalTelemetry,
          durationMs,
          numTurns,
        }
      : {
          durationMs,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          totalCostUsd: 0,
          numTurns,
        },
  };
};
