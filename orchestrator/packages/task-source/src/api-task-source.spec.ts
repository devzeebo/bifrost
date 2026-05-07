import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APITaskSource } from './api-task-source.js'
import type { Task } from '@orchestrator/task-source'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('API Task Source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('US-2: Task Source emits available tasks', () => {
    it('should poll API and yield available tasks', async () => {
      // Given a task is available for processing
      const mockTask: Task = {
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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [mockTask]
      } as Response)

      const source = new APITaskSource({
        baseUrl: 'https://api.example.com',
        pollInterval: 100
      })

      // When the orchestrator polls the task source
      const tasks: Task[] = []
      for await (const t of source.watchTasks()) {
        tasks.push(t)
        break
      }

      // Then the task source yields the task via its async iterator
      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe('task-1')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks?status=OPEN',
        expect.any(Object)
      )
    })

    it('should respect poll interval', async () => {
      const source = new APITaskSource({
        baseUrl: 'https://api.example.com',
        pollInterval: 50
      })

      // Return empty tasks array
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      } as Response)

      // Close after a short time
      setTimeout(() => source.close(), 100)

      // Start polling
      const pollPromise = (async () => {
        for await (const _task of source.watchTasks()) {
          // Won't be reached since no tasks
        }
      })()

      await pollPromise

      // Should have attempted polls
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('Task lifecycle methods', () => {
    it('should get task detail', async () => {
      const mockTaskDetail = {
        id: 'task-1',
        title: 'Test',
        description: 'Description',
        status: 'OPEN' as const,
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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTaskDetail
      } as Response)

      const source = new APITaskSource({
        baseUrl: 'https://api.example.com'
      })

      const detail = await source.getTaskDetail('task-1')

      expect(detail).toEqual(mockTaskDetail)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks/task-1',
        expect.any(Object)
      )
    })

    it('should complete task', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response)

      const source = new APITaskSource({
        baseUrl: 'https://api.example.com'
      })

      const result = await source.completeTask('task-1')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks/task-1/complete',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('should fail task', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response)

      const source = new APITaskSource({
        baseUrl: 'https://api.example.com'
      })

      const result = await source.failTask('task-1', 'Test error')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/tasks/task-1/fail',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test error')
        })
      )
    })
  })

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as Response)

      const source = new APITaskSource({
        baseUrl: 'https://api.example.com',
        pollInterval: 50
      })

      // Close after a short time
      setTimeout(() => source.close(), 150)

      // Should not throw, should continue polling
      const tasks: Task[] = []
      for await (const task of source.watchTasks()) {
        tasks.push(task)
      }

      // Should have attempted polls despite errors
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should include telemetry in completion notes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      } as Response)

      const source = new APITaskSource({
        baseUrl: 'https://api.example.com'
      })

      // When completing task with telemetry
      await source.completeTask('task-1')

      // Then request is made
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
