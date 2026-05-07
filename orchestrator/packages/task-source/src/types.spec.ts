import { describe, it, expect } from 'vitest'
import { TaskStatus, Task, TaskDetail } from './types.js'

describe('TaskSource Types', () => {
  describe('TaskStatus enum', () => {
    it('should have all required status values', () => {
      // FR-1: Task Status enum values
      expect(TaskStatus.OPEN).toBe('OPEN')
      expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS')
      expect(TaskStatus.COMPLETED).toBe('COMPLETED')
      expect(TaskStatus.FAILED).toBe('FAILED')
      expect(TaskStatus.CANCELLED).toBe('CANCELLED')
    })
  })

  describe('Task type', () => {
    it('should create a valid Task with required fields', () => {
      const task: Task = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.OPEN,
        tags: ['worker:reviewer'],
        claimant: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        priority: 1
      }

      expect(task.id).toBe('task-123')
      expect(task.status).toBe(TaskStatus.OPEN)
      expect(task.tags).toContain('worker:reviewer')
    })
  })

  describe('TaskDetail type', () => {
    it('should extend Task with additional fields', () => {
      const detail: TaskDetail = {
        id: 'task-123',
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.OPEN,
        tags: ['worker:reviewer'],
        claimant: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        priority: 1,
        dependencies: [],
        notes: [],
        acceptanceCriteria: [],
        retro: []
      }

      expect(detail.dependencies).toEqual([])
      expect(detail.notes).toEqual([])
    })
  })
})
