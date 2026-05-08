import type { AgentDefinition } from './types.js'
import { validateTaskState } from './validator.js'
import { executeHooks, type HookExecutionContext } from './hook-executor.js'
import { renderPrompt } from './handlebars-renderer.js'
import type { Task, TaskSource } from '@orchestrator/task-source'
import type { Engine, EngineContext, EngineResult } from '@orchestrator/engine'

type OrchestrationResult = {
  outcome: 'completed' | 'failed' | 'halted'
  telemetry?: {
    durationMs: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheCreationTokens: number
    totalCostUsd: number
    numTurns: number
  }
  error?: string
}

type HookExecFn = (
  opts: { scriptPath: string; stdin: string; timeout: number }
) => Promise<{ exitCode: number; stdout: string; stderr: string }>

type OrchestrateOptions = {
  task: Task
  agent: AgentDefinition
  taskSource: TaskSource
  engine: Engine
  projectDir: string
  hookExec?: HookExecFn
}

/**
 * Execute the full orchestration lifecycle for a task.
 * FR-14: Orchestration Lifecycle
 * US-3: Agent Operator - Dispatch agent on task
 */
export const orchestrate = async (
  options: OrchestrateOptions
): Promise<OrchestrationResult> => {
  const { task, agent, taskSource, engine, projectDir, hookExec } = options

  const startTime = Date.now()
  let totalTelemetry: EngineResult['stats'] = null
  let numTurns = 0

  // Step 1: Validate taskState against agent parameter schema
  const validation = validateTaskState(task.taskState, agent.template.parameters)

  if (!validation.valid) {
    await taskSource.failTask(task.id, validation.errors.join('; '))
    return { outcome: 'failed', error: validation.errors.join('; ') }
  }

  // Step 2: Execute pre-task hooks
  const hookContext: HookExecutionContext = {
    projectDir,
    params: task.taskState,
    taskState: task.taskState
  }

  const defaultHookExec: HookExecFn = async () => ({ exitCode: 0, stdout: '', stderr: '' })
  const execFn = hookExec ?? defaultHookExec

  const startHookResults = await executeHooks(agent.hooks.Start, 'Start', hookContext, execFn)

  for (const hook of startHookResults) {
    if (hook.fatal) {
      await taskSource.failTask(task.id, `Start hook ${hook.hookName} failed: ${hook.stderr}`)
      return { outcome: 'failed', error: hook.stderr }
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
    verbose: false
  }

  // Main execution loop (handles follow-ups)
  let maxFollowUps = 10
  let lastMessage = ''

  while (maxFollowUps-- > 0) {
    numTurns++

    const engineResult: EngineResult = await engine.execute(engineContext)

    if (engineResult.stats) {
      if (!totalTelemetry) {
        totalTelemetry = { ...engineResult.stats }
      } else {
        totalTelemetry.durationMs += engineResult.stats.durationMs
        totalTelemetry.inputTokens += engineResult.stats.inputTokens
        totalTelemetry.outputTokens += engineResult.stats.outputTokens
        totalTelemetry.cacheReadTokens += engineResult.stats.cacheReadTokens
        totalTelemetry.cacheCreationTokens += engineResult.stats.cacheCreationTokens
        totalTelemetry.totalCostUsd += engineResult.stats.totalCostUsd
        totalTelemetry.numTurns += engineResult.stats.numTurns
      }
    }

    lastMessage = engineResult.lastMessage || lastMessage

    // Step 4: Execute post-task hooks
    const stopHookResults = await executeHooks(agent.hooks.Stop, 'Stop', hookContext, execFn)

    let needsFollowUp = false
    let followUpMessage = ''

    for (const hook of stopHookResults) {
      if (hook.needsFollowUp) {
        needsFollowUp = true
        followUpMessage = hook.stdout
        break
      }

      if (hook.fatal) {
        await taskSource.failTask(task.id, `Stop hook ${hook.hookName} failed: ${hook.stderr}`)
        return { outcome: 'failed', error: hook.stderr }
      }
    }

    if (!needsFollowUp) {
      break
    }

    if (engine.sendFollowUp) {
      const followUpResult = await engine.sendFollowUp(followUpMessage)
      if (followUpResult.stats) {
        if (!totalTelemetry) {
          totalTelemetry = { ...followUpResult.stats }
        } else {
          totalTelemetry.durationMs += followUpResult.stats.durationMs
          totalTelemetry.inputTokens += followUpResult.stats.inputTokens
          totalTelemetry.outputTokens += followUpResult.stats.outputTokens
          totalTelemetry.cacheReadTokens += followUpResult.stats.cacheReadTokens
          totalTelemetry.cacheCreationTokens += followUpResult.stats.cacheCreationTokens
          totalTelemetry.totalCostUsd += followUpResult.stats.totalCostUsd
          totalTelemetry.numTurns += followUpResult.stats.numTurns
        }
      }
      numTurns++
    }
  }

  // Step 5: Report success
  await taskSource.completeTask(task.id)

  const durationMs = Date.now() - startTime

  return {
    outcome: 'completed',
    telemetry: totalTelemetry ? {
      ...totalTelemetry,
      durationMs,
      numTurns
    } : {
      durationMs,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalCostUsd: 0,
      numTurns
    }
  }
}
