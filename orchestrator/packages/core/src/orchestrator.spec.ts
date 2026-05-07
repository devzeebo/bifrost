import { describe, it, expect, vi } from 'vitest'
import { orchestrate } from './orchestrator.js'
import type { AgentDefinition, HookExecutionContext } from './types.js'
import type { Task, TaskSource, Engine, EngineResult } from '@orchestrator/task-source'

describe('Orchestrator Lifecycle - FR-14', () => {
  describe('US-3: Agent Operator - Dispatch agent on task', () => {
    it('should execute full orchestration lifecycle successfully', async () => {
      // Given a task is yielded from the task source
      const task: Task = {
        id: 'task-1',
        title: 'Review code',
        description: 'Review PR #123',
        status: 'OPEN' as const,
        tags: ['worker:reviewer'],
        claimant: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: 1
      }

      // And the agent is configured in the agent catalog
      const agent: AgentDefinition = {
        name: 'reviewer',
        description: 'Code review agent',
        tools: ['readFile', 'edit'],
        toolClasses: [],
        template: { parameters: { language: { name: 'string' } } },
        hooks: { Start: [], Stop: [] },
        promptBody: 'Review the {{language.name}} code.'
      }

      const taskState = { language: { name: 'Python' } }

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () { yield task },
        getTaskDetail: vi.fn().mockResolvedValue(null),
        completeTask: vi.fn().mockResolvedValue(true),
        failTask: vi.fn().mockResolvedValue(true)
      }

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: 'Review complete',
          stats: {
            durationMs: 5000,
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadTokens: 100,
            cacheCreationTokens: 50,
            totalCostUsd: 0.05,
            numTurns: 3
          }
        })
      }

      // When the orchestrator receives the task
      const result = await orchestrate({
        task,
        agent,
        taskState,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project'
      })

      // Then Start hooks are executed (none in this case)
      // And the reviewer agent is invoked
      expect(mockEngine.execute).toHaveBeenCalled()

      // And Stop hooks are executed (none in this case)
      // And the task is marked complete
      expect(result.outcome).toBe('completed')
      expect(mockTaskSource.completeTask).toHaveBeenCalledWith('task-1')
    })

    it('should mark task as failed when taskState validation fails', async () => {
      // Given a task's taskState fails agent schema validation
      const task: Task = {
        id: 'task-2',
        title: 'Test',
        description: null,
        status: 'OPEN' as const,
        tags: ['worker:test'],
        claimant: null,
        createdAt: null,
        updatedAt: null,
        priority: 1
      }

      const agent: AgentDefinition = {
        name: 'test',
        description: 'Test agent',
        tools: [],
        toolClasses: [],
        template: { parameters: { language: { name: 'string' } } },
        hooks: { Start: [], Stop: [] },
        promptBody: 'Test'
      }

      // Missing required language parameter
      const taskState = {}

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () { yield task },
        getTaskDetail: vi.fn().mockResolvedValue(null),
        completeTask: vi.fn().mockResolvedValue(true),
        failTask: vi.fn().mockResolvedValue(true)
      }

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: 'Done',
          stats: null
        })
      }

      // When the orchestrator receives the task
      const result = await orchestrate({
        task,
        agent,
        taskState,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project'
      })

      // Then the task is marked as failed
      expect(result.outcome).toBe('failed')
      expect(mockTaskSource.failTask).toHaveBeenCalledWith('task-2', expect.stringContaining('Missing required parameter'))
      expect(mockEngine.execute).not.toHaveBeenCalled()
    })

    it('should trigger follow-up when Stop hook returns exit code 1', async () => {
      // Given Stop hooks that report issues (exit code 1)
      const agent: AgentDefinition = {
        name: 'test',
        description: 'Test',
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [],
          Stop: [{ name: 'lint', scriptPath: '/lint.mjs', timeout: 30000 }]
        },
        promptBody: 'Test'
      }

      const task: Task = {
        id: 'task-3',
        title: 'Test',
        description: null,
        status: 'OPEN' as const,
        tags: ['worker:test'],
        claimant: null,
        createdAt: null,
        updatedAt: null,
        priority: 1
      }

      const taskState = {}

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () { yield task },
        getTaskDetail: vi.fn().mockResolvedValue(null),
        completeTask: vi.fn().mockResolvedValue(true),
        failTask: vi.fn().mockResolvedValue(true)
      }

      const engineResult: EngineResult = {
        success: true,
        skipFulfill: false,
        lastMessage: 'Done',
        stats: null
      }

      const mockEngine: Engine = {
        execute: vi.fn()
          .mockResolvedValueOnce(engineResult)
          .mockResolvedValueOnce({
            ...engineResult,
            lastMessage: 'Fixed lint issues'
          })
      }

      const mockExec = vi.fn()
        .mockResolvedValueOnce({ exitCode: 1, stdout: 'Lint errors', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

      // When orchestrating
      const result = await orchestrate({
        task,
        agent,
        taskState,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
        hookExec: mockExec
      })

      // Then follow-up is triggered (engine called twice)
      expect(mockEngine.execute).toHaveBeenCalledTimes(2)
      expect(result.outcome).toBe('completed')
    })
  })
})
