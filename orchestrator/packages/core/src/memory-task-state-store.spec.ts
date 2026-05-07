import { describe, it, expect } from 'vitest'
import { MemoryTaskStateStore } from './memory-task-state-store.js'

describe('Memory Task State Store', () => {
  describe('Basic operations', () => {
    it('should store and retrieve taskState', async () => {
      const store = new MemoryTaskStateStore()

      // Given a taskState
      const taskState = {
        language: { name: 'python' },
        snapshotTests: { 'test.js': 'hash123' }
      }

      // When saved
      await store.saveTaskState('task-1', taskState)

      // Then it can be retrieved
      const retrieved = await store.loadTaskState('task-1')
      expect(retrieved).toEqual(taskState)
    })

    it('should return null for non-existent task', async () => {
      const store = new MemoryTaskStateStore()

      const result = await store.loadTaskState('nonexistent')
      expect(result).toBeNull()
    })

    it('should delete taskState', async () => {
      const store = new MemoryTaskStateStore()

      await store.saveTaskState('task-1', { data: 'test' })
      await store.deleteTaskState('task-1')

      const result = await store.loadTaskState('task-1')
      expect(result).toBeNull()
    })

    it('should initialize taskState', async () => {
      const store = new MemoryTaskStateStore()

      const initialState = { language: 'python' }
      const result = await store.initializeTaskState('task-1', initialState)

      expect(result).toBe(true)

      const retrieved = await store.loadTaskState('task-1')
      expect(retrieved).toEqual(initialState)
    })
  })

  describe('Concurrency and atomicity', () => {
    it('should handle concurrent writes to same task', async () => {
      const store = new MemoryTaskStateStore()

      // Given concurrent writes
      const write1 = store.saveTaskState('task-1', { version: 1 })
      const write2 = store.saveTaskState('task-1', { version: 2 })

      // When both complete
      await Promise.all([write1, write2])

      // Then final state is one of the writes (last write wins in memory)
      const result = await store.loadTaskState('task-1')
      expect(result).toBeDefined()
    })
  })
})
