import type {
  AgentDefinition,
  OrchestrationContext,
  HookExecutionContext,
  HookResult,
} from "./types";
import { validateTaskState } from "./validator";
import { renderPrompt } from "./handlebars-renderer";
import type { Task, TaskSource } from "@bifrost-ai/task-source";
import type { Engine, EngineContext, EngineResult } from "@bifrost-ai/engine";
import { executeHooks } from "./hook-executor";
import createDebug from "debug";

const debug = createDebug("bifrost");

type OrchestrationResult = {
  outcome: "completed" | "failed" | "halted" | "skipped" | "paused";
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
  pauseReason?: string;
};

type OrchestrateOptions = {
  task: Task;
  agent: AgentDefinition;
  taskSource: TaskSource;
  engine: Engine;
  context: OrchestrationContext;
};

const handleEngineFailure = async (
  engineResult: EngineResult,
  taskId: string,
  taskSource: TaskSource,
): Promise<OrchestrationResult> => {
  if (engineResult.skipFulfill) {
    return { outcome: "skipped", error: engineResult.lastMessage ?? "unknown" };
  }
  await taskSource.failTask(
    taskId,
    `Engine execution failed: ${engineResult.lastMessage ?? "unknown"}`,
  );
  return { outcome: "failed", error: engineResult.lastMessage ?? "unknown" };
};

type LoopOptions = {
  task: Task;
  agent: AgentDefinition;
  taskSource: TaskSource;
  engine: Engine;
  engineContext: EngineContext;
  hookContext: Omit<HookExecutionContext, "hookName">;
  getCurrentTaskState: () => Record<string, unknown>;
};

type LoopResult = {
  earlyReturn?: OrchestrationResult;
  totalTelemetry: EngineResult["stats"];
  numTurns: number;
};

const runEngineLoop = async (opts: LoopOptions): Promise<LoopResult> => {
  const { task, agent, taskSource, engine, engineContext, hookContext, getCurrentTaskState } = opts;
  const maxFollowUps = 10;
  let attemptsUsed = 0;
  let followUpInstructions: string | undefined = undefined;
  let sessionId: string | undefined = undefined;
  let totalTelemetry: EngineResult["stats"] = null;
  let numTurns = 0;

  while (((attemptsUsed += 1), attemptsUsed <= maxFollowUps)) {
    numTurns += 1;
    debug("engine execute attempt %d/%d task=%s", attemptsUsed, maxFollowUps, task.id);

    const engineResult = await engine.execute(
      {
        ...engineContext,
        taskState: getCurrentTaskState(),
        instructions: followUpInstructions ?? engineContext.instructions,
      },
      sessionId,
    );

    debug(
      "engine result success=%s cost=$%s",
      engineResult.success,
      engineResult.stats?.totalCostUsd?.toFixed(4) ?? "n/a",
    );

    if (!engineResult.success) {
      debug("engine failure: %s", engineResult.lastMessage);
      return {
        earlyReturn: await handleEngineFailure(engineResult, task.id, taskSource),
        totalTelemetry,
        numTurns,
      };
    }

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

    const stopHookResults = await executeHooks({
      hooks: agent.hooks.Stop,
      lifecycle: "Stop",
      context: hookContext,
    });

    let needsFollowUp = false;
    let followUpMessage = "";

    for (const hook of stopHookResults) {
      if (hook.outcome === "fatal") {
        debug("stop hook fatal: %s", hook.message);
        await taskSource.failTask(task.id, `Stop hook failed: ${hook.message ?? "unknown error"}`);
        return {
          earlyReturn: { outcome: "failed", error: hook.message },
          totalTelemetry,
          numTurns,
        };
      }
      if (hook.outcome === "pause") {
        debug("stop hook pause: %s", hook.message);
        await taskSource.pauseTask(task.id);
        return {
          earlyReturn: { outcome: "paused", pauseReason: hook.message },
          totalTelemetry,
          numTurns,
        };
      }
      if (hook.outcome === "follow-up") {
        needsFollowUp = true;
        followUpMessage = hook.message ?? "";
        debug("stop hook follow-up: %s", followUpMessage);
        break;
      }
    }

    if (!needsFollowUp) {
      break;
    }
    followUpInstructions = followUpMessage;
  }

  if (attemptsUsed > maxFollowUps) {
    await taskSource.failTask(task.id, "Max follow-ups exceeded");
    return {
      earlyReturn: { outcome: "halted", error: "Max follow-ups exceeded" },
      totalTelemetry,
      numTurns,
    };
  }

  return { totalTelemetry, numTurns };
};

/**
 * Execute the full orchestration lifecycle for a task.
 * FR-14: Orchestration Lifecycle
 * US-3: Agent Operator - Dispatch agent on task
 */
export const orchestrate = async (options: OrchestrateOptions): Promise<OrchestrationResult> => {
  const { task, agent, taskSource, engine, context } = options;

  const startTime = Date.now();

  debug("orchestrate task=%s agent=%s", task.id, agent.name);

  // Step 1: Set up mutable task state and hook context
  let currentTaskState = { ...task.taskState };

  const getTaskState = () => ({ ...currentTaskState });

  const setTaskState = async (arg: Record<string, unknown>) => {
    currentTaskState = { ...arg };
    await taskSource.setState(task.id, arg);
  };

  const hookContext: Omit<HookExecutionContext, "hookName"> = {
    taskId: task.id,
    context,
    params: task.taskState,
    metadata: task.metadata,
    getTaskState,
    setTaskState,
  };

  // Step 2: Execute pre-task hooks; hooks may mutate context and task state
  const startHookResults: HookResult[] = [];

  for (const hookSpec of agent.hooks.Start) {
    debug("Start hook %s start", hookSpec.name);
    const result = await hookSpec
      .fn({ ...hookContext, hookName: hookSpec.name })
      .then((res) => {
        debug("Start hook %s → %s", hookSpec.name, res.outcome);
        return res;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        debug("Start hook %s threw: %s", hookSpec.name, message);
        return { outcome: "fatal" as const, message };
      });

    startHookResults.push(result);

    if (result.outcome === "fatal") {
      debug("start hook fatal: %s", result.message);
      await taskSource.failTask(task.id, `Start hook failed: ${result.message ?? "unknown error"}`);
      return { outcome: "failed", error: result.message };
    }

    if (result.outcome === "skip") {
      debug("start hook skip: %s", result.message);
      await taskSource.completeTask(task.id);
      return { outcome: "skipped", skipReason: result.message };
    }
  }

  // Step 3: Validate post-hook task state against agent parameter schema
  // taskId is injected alongside taskState for Handlebars, so include it here too
  const validation = validateTaskState(
    { taskId: task.id, ...currentTaskState },
    agent.template.parameters,
  );

  if (!validation.valid) {
    debug("task %s validation failed: %s", task.id, validation.errors.join("; "));
    await taskSource.failTask(task.id, validation.errors.join("; "));
    return { outcome: "failed", error: validation.errors.join("; ") };
  }

  debug("task %s validation passed", task.id);

  // Step 4: Render prompt with post-hook task state and taskId
  const renderedAgentPrompt = renderPrompt(agent.promptBody, {
    taskId: task.id,
    metadata: task.metadata,
    taskState: currentTaskState,
  });

  const engineContext: EngineContext = {
    taskId: task.id,
    workingDir: context.projectDir,
    agent: {
      ...agent,
      promptBody: renderedAgentPrompt,
      tools: context.tools ?? agent.tools,
    },
    taskState: currentTaskState,
    metadata: task.metadata,
    instructions: context.instructions,
    setState: async (newState: Record<string, unknown>) => {
      currentTaskState = { ...newState };
      await taskSource.setState(task.id, newState);
    },
  };

  // Steps 3-4: Engine + stop hooks loop
  const loopResult = await runEngineLoop({
    task,
    agent,
    taskSource,
    engine,
    engineContext,
    hookContext,
    getCurrentTaskState: () => currentTaskState,
  });

  if (loopResult.earlyReturn) {
    return loopResult.earlyReturn;
  }

  const { totalTelemetry, numTurns } = loopResult;

  // Step 5: Report success
  await taskSource.completeTask(task.id);

  const durationMs = Date.now() - startTime;
  debug("task %s completed in %dms", task.id, durationMs);

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
