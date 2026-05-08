import { describe, it, expect, vi } from 'vitest';
import { orchestrate } from './orchestrator.js';
import type { AgentDefinition } from './types.js';
import type { HookExecutionContext } from './hook-executor.js';
import type { Task, TaskSource } from '@orchestrator/task-source';
import type { Engine, EngineResult } from '@orchestrator/engine';

describe('Orchestrator', () => {
  describe('task execution lifecycle', () => {
    it('should validate taskState → execute pre-hooks → invoke engine → execute post-hooks → report success', async () => {
      // Given a task with valid taskState
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        taskState: { language: 'Python' },
        metadata: { priority: 'high' },
      };

      const agent: AgentDefinition = {
        name: 'reviewer',
        description: 'Code review agent',
        tools: ['readFile', 'edit'],
        toolClasses: [],
        template: { parameters: { language: { type: 'string' } } },
        hooks: { Start: [], Stop: [] },
        promptBody: 'Review the code.',
      };

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(undefined),
        failTask: vi.fn().mockResolvedValue(undefined),
        setState: vi.fn().mockResolvedValue(undefined),
      };

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
            numTurns: 3,
          },
        }),
      };

      // When orchestrating
      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
      });

      // Then validation passes, hooks execute, engine runs, task completes
      expect(result.outcome).toBe('completed');
      expect(mockEngine.execute).toHaveBeenCalled();
      expect(mockTaskSource.completeTask).toHaveBeenCalledWith('task-1');
    });

    it('should fail task when taskState validation fails', async () => {
      // Given a task with invalid taskState
      const task: Task = {
        id: 'task-2',
        agentId: 'agent-1',
        taskState: {}, // Missing required 'language' parameter
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: 'reviewer',
        description: 'Code review agent',
        tools: [],
        toolClasses: [],
        template: { parameters: { language: { type: 'string' } } },
        hooks: { Start: [], Stop: [] },
        promptBody: 'Review the code.',
      };

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(undefined),
        failTask: vi.fn().mockResolvedValue(undefined),
        setState: vi.fn().mockResolvedValue(undefined),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: 'Done',
          stats: null,
        }),
      };

      // When orchestrating
      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
      });

      // Then task fails, engine not called
      expect(result.outcome).toBe('failed');
      expect(mockTaskSource.failTask).toHaveBeenCalledWith(
        'task-2',
        expect.stringContaining('language')
      );
      expect(mockEngine.execute).not.toHaveBeenCalled();
    });

    it('should pass setState callback to engine', async () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        taskState: { step: 1 },
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: 'test',
        description: 'Test',
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: { Start: [], Stop: [] },
        promptBody: 'Test',
      };

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(undefined),
        failTask: vi.fn().mockResolvedValue(undefined),
        setState: vi.fn().mockResolvedValue(undefined),
      };

      let capturedSetState: ((state: Record<string, unknown>) => Promise<void>) | null = null;

      const mockEngine: Engine = {
        execute: vi.fn().mockImplementation(async (context) => {
          capturedSetState = context.setState;
          return {
            success: true,
            skipFulfill: false,
            lastMessage: 'Done',
            stats: null,
          };
        }),
      };

      await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
      });

      // Engine receives setState callback
      expect(capturedSetState).toBeDefined();

      // Calling setState persists to task source
      await capturedSetState!({ step: 2 });
      expect(mockTaskSource.setState).toHaveBeenCalledWith('task-1', { step: 2 });
    });

    it('should fail task when Start hook returns fatal error', async () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: 'test',
        description: 'Test',
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [{ name: 'fatal-hook', scriptPath: '/fatal.mjs', timeout: 30000 }],
          Stop: [],
        },
        promptBody: 'Test',
      };

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(undefined),
        failTask: vi.fn().mockResolvedValue(undefined),
        setState: vi.fn().mockResolvedValue(undefined),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: 'Done',
          stats: null,
        }),
      };

      const mockExec = vi.fn().mockResolvedValue({
        exitCode: 2, // Fatal
        stdout: '',
        stderr: 'Fatal error',
      });

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
        hookExec: mockExec,
      });

      expect(result.outcome).toBe('failed');
      expect(mockTaskSource.failTask).toHaveBeenCalledWith(
        'task-1',
        expect.stringContaining('fatal-hook')
      );
      expect(mockEngine.execute).not.toHaveBeenCalled();
    });

    it('should fail task when Stop hook returns fatal error', async () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: 'test',
        description: 'Test',
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [],
          Stop: [{ name: 'fatal-hook', scriptPath: '/fatal.mjs', timeout: 30000 }],
        },
        promptBody: 'Test',
      };

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(undefined),
        failTask: vi.fn().mockResolvedValue(undefined),
        setState: vi.fn().mockResolvedValue(undefined),
      };

      const mockEngine: Engine = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          skipFulfill: false,
          lastMessage: 'Done',
          stats: null,
        }),
      };

      const mockExec = vi.fn().mockResolvedValue({
        exitCode: 2, // Fatal
        stdout: '',
        stderr: 'Fatal error',
      });

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
        hookExec: mockExec,
      });

      expect(result.outcome).toBe('failed');
      expect(mockTaskSource.failTask).toHaveBeenCalledWith(
        'task-1',
        expect.stringContaining('fatal-hook')
      );
    });

    it('should support follow-up loop when Stop hook returns exit code 1', async () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        taskState: {},
        metadata: {},
      };

      const agent: AgentDefinition = {
        name: 'test',
        description: 'Test',
        tools: [],
        toolClasses: [],
        template: { parameters: {} },
        hooks: {
          Start: [],
          Stop: [{ name: 'lint', scriptPath: '/lint.mjs', timeout: 30000 }],
        },
        promptBody: 'Test',
      };

      const mockTaskSource: TaskSource = {
        watchTasks: async function* () {
          yield task;
        },
        completeTask: vi.fn().mockResolvedValue(undefined),
        failTask: vi.fn().mockResolvedValue(undefined),
        setState: vi.fn().mockResolvedValue(undefined),
      };

      const mockEngine: Engine = {
        execute: vi
          .fn()
          .mockResolvedValueOnce({
            success: true,
            skipFulfill: false,
            lastMessage: 'First run',
            stats: null,
          })
          .mockResolvedValueOnce({
            success: true,
            skipFulfill: false,
            lastMessage: 'Second run',
            stats: null,
          }),
      };

      const mockExec = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 1, stdout: 'Fix lint issues', stderr: '' })
        .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' });

      const result = await orchestrate({
        task,
        agent,
        taskSource: mockTaskSource,
        engine: mockEngine,
        projectDir: '/test/project',
        hookExec: mockExec,
      });

      expect(result.outcome).toBe('completed');
      expect(mockEngine.execute).toHaveBeenCalledTimes(2);
    });
  });
});
