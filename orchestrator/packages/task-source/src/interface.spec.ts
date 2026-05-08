import { describe, it, expect, vi } from 'vitest';
import { TaskSource } from './interface.js';
import type { Task } from './types.js';

describe('TaskSource Interface', () => {
  describe('FR-1: Task Source Interface', () => {
    it('should require watchTasks method returning AsyncIterator', async () => {
      class MockTaskSource implements TaskSource {
        async *watchTasks(): AsyncGenerator<Task> {
          yield {
            id: 'task-1',
            agentId: 'agent-1',
            taskState: { step: 1 },
            metadata: { priority: 'high' },
          };
        }

        async completeTask(_taskId: string): Promise<void> {}

        async failTask(_taskId: string, _error: string): Promise<void> {}

        async setState(_taskId: string, _taskState: Record<string, unknown>): Promise<void> {}
      }

      const source = new MockTaskSource();
      const tasks = source.watchTasks();

      for await (const task of tasks) {
        expect(task.id).toBe('task-1');
        expect(task.agentId).toBe('agent-1');
        expect(task.taskState).toEqual({ step: 1 });
        expect(task.metadata).toEqual({ priority: 'high' });
        break;
      }
    });

    it('should require completeTask method', async () => {
      const source: TaskSource = {
        async *watchTasks() {
          yield {
            id: 'task-1',
            agentId: 'agent-1',
            taskState: {},
            metadata: {},
          };
        },
        async completeTask(_taskId: string): Promise<void> {},
        async failTask(_taskId: string, _error: string): Promise<void> {},
        async setState(_taskId: string, _taskState: Record<string, unknown>): Promise<void> {},
      };

      await source.completeTask('task-1');
    });

    it('should require failTask method', async () => {
      const source: TaskSource = {
        async *watchTasks() {
          yield {
            id: 'task-1',
            agentId: 'agent-1',
            taskState: {},
            metadata: {},
          };
        },
        async completeTask(_taskId: string): Promise<void> {},
        async failTask(_taskId: string, _error: string): Promise<void> {},
        async setState(_taskId: string, _taskState: Record<string, unknown>): Promise<void> {},
      };

      await source.failTask('task-1', 'Test error');
    });

    it('should require setState method', async () => {
      const source: TaskSource = {
        async *watchTasks() {
          yield {
            id: 'task-1',
            agentId: 'agent-1',
            taskState: {},
            metadata: {},
          };
        },
        async completeTask(_taskId: string): Promise<void> {},
        async failTask(_taskId: string, _error: string): Promise<void> {},
        async setState(_taskId: string, _taskState: Record<string, unknown>): Promise<void> {},
      };

      await source.setState('task-1', { step: 2 });
    });
  });
});
