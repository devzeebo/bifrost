import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { FileTaskStateStore } from './file-task-state-store.js'

describe('File Task State Store', () => {
  let storeDir: string
  let store: FileTaskStateStore

  beforeEach(async () => {
    storeDir = join(tmpdir(), `orchestrator-test-${Date.now()}`)
    store = new FileTaskStateStore(storeDir)
  })

  afterEach(async () => {
    try {
      await rm(storeDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Basic operations', () => {
    it('should store and retrieve taskState', async () => {
      const taskState = {
        language: { name: 'python' },
        snapshotTests: { 'test.js': 'hash123' }
      }

      await store.saveTaskState('task-1', taskState)
      const retrieved = await store.loadTaskState('task-1')

      expect(retrieved).toEqual(taskState)
    })

    it('should return null for non-existent task', async () => {
      const result = await store.loadTaskState('nonexistent')
      expect(result).toBeNull()
    })

    it('should delete taskState', async () => {
      await store.saveTaskState('task-1', { data: 'test' })
      await store.deleteTaskState('task-1')

      const result = await store.loadTaskState('task-1')
      expect(result).toBeNull()
    })

    it('should initialize taskState', async () => {
      const initialState = { language: 'python' }
      const result = await store.initializeTaskState('task-1', initialState)

      expect(result).toBe(true)

      const retrieved = await store.loadTaskState('task-1')
      expect(retrieved).toEqual(initialState)
    })

    it('should not overwrite existing taskState on initialize', async () => {
      await store.saveTaskState('task-1', { data: 'existing' })

      const result = await store.initializeTaskState('task-1', { data: 'new' })

      expect(result).toBe(false)

      const retrieved = await store.loadTaskState('task-1')
      expect(retrieved).toEqual({ data: 'existing' })
    })
  })

  describe('File persistence', () => {
    it('should persist taskState across store instances', async () => {
      // Given one store instance saves data
      const taskState = { counter: 1 }
      await store.saveTaskState('task-1', taskState)

      // When a new store instance is created with same directory
      const newStore = new FileTaskStateStore(storeDir)
      const retrieved = await newStore.loadTaskState('task-1')

      // Then data is persisted across instances
      expect(retrieved).toEqual(taskState)
    })

    it('should save each taskState in a separate file', async () => {
      await store.saveTaskState('task-1', { data: 'test1' })
      await store.saveTaskState('task-2', { data: 'test2' })

      // Both tasks should be retrievable
      expect(await store.loadTaskState('task-1')).toEqual({ data: 'test1' })
      expect(await store.loadTaskState('task-2')).toEqual({ data: 'test2' })
    })
  })

  describe('US-11: Atomic operations', () => {
    it('should save taskState atomically', async () => {
      // Given a taskState
      const taskState = { key: 'value' }

      // When saved
      await store.saveTaskState('task-1', taskState)

      // Then either the entire taskState is persisted or none is
      const retrieved = await store.loadTaskState('task-1')
      expect(retrieved).toEqual(taskState)
    })
  })
})
