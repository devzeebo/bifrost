import { describe, it, expect } from 'vitest'
import { MemoryTaskSource } from './memory-task-source.js'
import type { Task } from '@orchestrator/task-source'

describe('Memory Task Source - US-2', () => {
  describe('Task Source emits available tasks', () => {
    it('should yield tasks via async iterator', async () => {
      // Given a task is available for processing
      const source = new MemoryTaskSource()

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'OPEN' as const,
        tags: ['worker:reviewer'],
        claimant: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority: 1
      }

      await source.addTask(task)

      // When the orchestrator polls the task source
      const tasks: Task[] = []
      for await (const t of source.watchTasks()) {
        tasks.push(t)
        break // Get first task
      }

      // Then the task source yields the task via its async iterator
      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe('task-1')
    })

    it('should handle concurrent polling without duplicates', async () => {
      // US-2: Task Source supports concurrent polling
      // Given two orchestrator instances poll simultaneously
      const source = new MemoryTaskSource()

      const task: Task = {
        id: 'task-1',
        title: 'Test',
        description: null,
        status: 'OPEN' as const,
        tags: ['worker:test'],
        claimant: null,
        createdAt: null,
        updatedAt: null,
        priority: 1
      }

      await source.addTask(task)

      // When both poll the task source
      const tasks1: Task[] = []
      const tasks2: Task[] = []

      const poll1 = (async () => {
        for await (const t of source.watchTasks()) {
          tasks1.push(t)
          break
        }
      })()

      const poll2 = (async () => {
        for await (const t of source.watchTasks()) {
          tasks2.push(t)
          break
        }
      })()

      await Promise.all([poll1, poll2])

      // Then each task is yielded to at most one orchestrator
      // (In memory implementation, first consumer wins)
      expect(tasks1.length + tasks2.length).toBe(1)
    })

    it('should not yield tasks after they are completed', async () => {
      // Given a task that has been completed
      const source = new MemoryTaskSource()

      const task: Task = {
        id: 'task-1',
        title: 'Test',
        description: null,
        status: 'OPEN' as const,
        tags: [],
        claimant: null,
        createdAt: null,
        updatedAt: null,
        priority: 1
      }

      await source.addTask(task)
      await source.completeTask('task-1')

      // When the orchestrator polls
      const tasks: Task[] = []
      for await (const t of source.watchTasks()) {
        tasks.push(t)
        break
      }

      // Then completed tasks are not yielded
      expect(tasks).toHaveLength(0)
    })
  })

  describe('Task lifecycle', () => {
    it('should mark task as completed', async () => {
      const source = new MemoryTaskSource()

      const task: Task = {
        id: 'task-1',
        title: 'Test',
        description: null,
        status: 'OPEN' as const,
        tags: [],
        claimant: null,
        createdAt: null,
        updatedAt: null,
        priority: 1
      }

      await source.addTask(task)
      const completed = await source.completeTask('task-1')

      expect(completed).toBe(true)

      const retrieved = await source.getTaskDetail('task-1')
      expect(retrieved?.status).toBe('COMPLETED')
    })

    it('should mark task as failed', async () => {
      const source = new MemoryTaskSource()

      const task: Task = {
        id: 'task-1',
        title: 'Test',
        description: null,
        status: 'OPEN' as const,
        tags: [],
        claimant: null,
        createdAt: null,
        updatedAt: null,
        priority: 1
      }

      await source.addTask(task)
      const failed = await source.failTask('task-1', 'Test error')

      expect(failed).toBe(true)

      const retrieved = await source.getTaskDetail('task-1')
      expect(retrieved?.status).toBe('FAILED')
    })

    it('should retrieve task detail', async () => {
      const source = new MemoryTaskSource()

      const task: Task = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'OPEN' as const,
        tags: ['worker:test'],
        claimant: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        priority: 1
      }

      await source.addTask(task)
      const detail = await source.getTaskDetail('task-1')

      expect(detail).toBeDefined()
      expect(detail?.id).toBe('task-1')
      expect(detail?.title).toBe('Test Task')
    })
  })
})
