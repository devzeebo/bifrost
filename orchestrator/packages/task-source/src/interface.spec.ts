import { describe, it, expect } from 'vitest'
import { TaskSource } from './interface.js'
import { TaskStatus } from './types.js'

describe('TaskSource Interface', () => {
  describe('FR-1: Task Source Interface', () => {
    it('should require watchTasks method returning AsyncIterator', async () => {
      // US-2: Task Source emits available tasks via async iterator
      class MockTaskSource implements TaskSource {
        async *watchTasks(): AsyncGenerator {
          yield {
            id: 'task-1',
            title: 'Test',
            description: null,
            status: TaskStatus.OPEN,
            tags: ['worker:test'],
            claimant: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            priority: 1
          }
        }

        async getTaskDetail(_taskId: string) {
          throw new Error('Not implemented')
        }

        async completeTask(_taskId: string) {
          return true
        }

        async failTask(_taskId: string, _error: string) {
          return true
        }
      }

      const source = new MockTaskSource()
      const tasks = source.watchTasks()

      for await (const task of tasks) {
        expect(task.id).toBe('task-1')
        expect(task.status).toBe(TaskStatus.OPEN)
        break
      }
    })

    it('should require getTaskDetail method', async () => {
      const source: TaskSource = {
        async *watchTasks() {
          yield {
            id: 'task-1',
            title: 'Test',
            description: null,
            status: TaskStatus.OPEN,
            tags: [],
            claimant: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            priority: 1
          }
        },
        async getTaskDetail(taskId: string) {
          return {
            id: taskId,
            title: 'Detail Test',
            description: 'Description',
            status: TaskStatus.OPEN,
            tags: [],
            claimant: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            priority: 1,
            dependencies: [],
            notes: [],
            acceptanceCriteria: [],
            retro: []
          }
        },
        async completeTask(_taskId: string) {
          return true
        },
        async failTask(_taskId: string, _error: string) {
          return true
        }
      }

      const detail = await source.getTaskDetail('task-1')
      expect(detail?.id).toBe('task-1')
      expect(detail?.dependencies).toEqual([])
    })

    it('should require completeTask method', async () => {
      const source: TaskSource = {
        async *watchTasks() {
          yield {
            id: 'task-1',
            title: 'Test',
            description: null,
            status: TaskStatus.OPEN,
            tags: [],
            claimant: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            priority: 1
          }
        },
        async getTaskDetail(_taskId: string) {
          return null
        },
        async completeTask(taskId: string) {
          return taskId === 'task-1'
        },
        async failTask(_taskId: string, _error: string) {
          return false
        }
      }

      const result = await source.completeTask('task-1')
      expect(result).toBe(true)
    })

    it('should require failTask method', async () => {
      const source: TaskSource = {
        async *watchTasks() {
          yield {
            id: 'task-1',
            title: 'Test',
            description: null,
            status: TaskStatus.OPEN,
            tags: [],
            claimant: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            priority: 1
          }
        },
        async getTaskDetail(_taskId: string) {
          return null
        },
        async completeTask(_taskId: string) {
          return false
        },
        async failTask(taskId: string, error: string) {
          return taskId === 'task-1' && error.length > 0
        }
      }

      const result = await source.failTask('task-1', 'Test error')
      expect(result).toBe(true)
    })
  })
})
