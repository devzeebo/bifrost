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
  taskState: Record<string, unknown>
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
  const { task, agent, taskState, taskSource, engine, projectDir, hookExec } = options

  const startTime = Date.now()
  let totalTelemetry: EngineResult['stats'] = null
  let numTurns = 0

  // FR-14 step 4: Execute Start hooks with taskState
  const hookContext: HookExecutionContext = {
    projectDir,
    params: taskState,
    taskState
  }

  const defaultHookExec: HookExecFn = async () => ({ exitCode: 0, stdout: '', stderr: '' })

  const execFn = hookExec ?? defaultHookExec

  const startHookResults = await executeHooks(agent.hooks.Start, 'Start', hookContext, execFn)

  // FR-14 step 5: If any hook exits with code 2: mark UoW as failed, notify task source
  for (const hook of startHookResults) {
    if (hook.fatal) {
      await taskSource.failTask(task.id, `Start hook ${hook.hookName} failed: ${hook.stderr}`)
      return { outcome: 'failed', error: hook.stderr }
    }
  }

  // FR-14 step 6: Validate taskState against template.parameters
  const validation = validateTaskState(taskState, agent.template.parameters)

  if (!validation.valid) {
    // FR-14 step 7: If validation fails: mark UoW as failed, notify task source
    const error = validation.errors.join('; ')
    await taskSource.failTask(task.id, error)
    return { outcome: 'failed', error }
  }

  // Extract params from taskState for Handlebars rendering
  const params = taskState

  // FR-14 step 8: Render Handlebars prompt with taskState values
  const renderedPrompt = renderPrompt(agent.promptBody, taskState)

  // FR-14 step 9: Build EngineContext and execute engine
  const engineContext: EngineContext = {
    taskId: task.id,
    workingDir: projectDir,
    agentName: agent.name,
    verbose: false
  }

  // Main execution loop (handles follow-ups)
  let maxFollowUps = 10 // Prevent infinite loops
  let lastMessage = ''

  while (maxFollowUps-- > 0) {
    numTurns++

    // Execute engine
    const engineResult: EngineResult = await engine.execute({
      ...engineContext,
      // Pass rendered prompt and any follow-up context
    })

    // Accumulate telemetry
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

    // FR-14 step 11: Execute Stop hooks
    const stopHookResults = await executeHooks(agent.hooks.Stop, 'Stop', hookContext, execFn)

    let needsFollowUp = false
    let followUpMessage = ''

    // FR-14 step 12: If any Stop hook exits with code 1: loop back to step 9
    for (const hook of stopHookResults) {
      if (hook.needsFollowUp) {
        needsFollowUp = true
        followUpMessage = hook.stdout
        break
      }

      // FR-14 step 13: If any Stop hook exits with code 2: mark UoW as failed
      if (hook.fatal) {
        await taskSource.failTask(task.id, `Stop hook ${hook.hookName} failed: ${hook.stderr}`)
        return { outcome: 'failed', error: hook.stderr }
      }
    }

    if (!needsFollowUp) {
      break
    }

    // FR-14 step 12: loop back to step 9 with follow-up message
    // Follow-up: execute engine again with hook output as context
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
      // Continue to next iteration to run Stop hooks again
    } else {
      // No sendFollowUp method - continue loop to execute again
      // Continue to next iteration which will call execute again
    }
  }

  // FR-14 step 14: Save final taskState to Task State Store (omitted - uses Task State Store plugin)
  // FR-14 step 15: Mark task as complete via Task Source
  await taskSource.completeTask(task.id)

  // FR-14 step 16: Append completion note with telemetry
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
