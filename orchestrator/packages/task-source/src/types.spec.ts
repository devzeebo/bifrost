import { describe, it, expect } from 'vitest';
import { TaskStatus, Task } from './types.js';

describe('TaskSource Types', () => {
  describe('TaskStatus enum', () => {
    it('should have all required status values', () => {
      expect(TaskStatus.OPEN).toBe('OPEN');
      expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(TaskStatus.COMPLETED).toBe('COMPLETED');
      expect(TaskStatus.FAILED).toBe('FAILED');
      expect(TaskStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('Task type', () => {
    it('should create a valid Task with required fields', () => {
      const task: Task = {
        id: 'task-123',
        agentId: 'agent-1',
        taskState: { language: 'Python', step: 1 },
        metadata: { priority: 'high', tags: ['bug'] },
      };

      expect(task.id).toBe('task-123');
      expect(task.agentId).toBe('agent-1');
      expect(task.taskState).toEqual({ language: 'Python', step: 1 });
      expect(task.metadata).toEqual({ priority: 'high', tags: ['bug'] });
    });

    it('should allow empty objects for taskState and metadata', () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        taskState: {},
        metadata: {},
      };

      expect(task.taskState).toEqual({});
      expect(task.metadata).toEqual({});
    });
  });
});
