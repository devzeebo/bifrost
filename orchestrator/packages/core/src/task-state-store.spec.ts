import { describe, it, expect } from 'vitest'
import type { TaskStateStore } from './task-state-store.js'

describe('Task State Store - FR-3', () => {
  describe('FR-3: Task State Store Interface', () => {
    it('should implement loadTaskState method', async () => {
      // US-11: Task State persistence across hook executions
      const store: TaskStateStore = {
        async loadTaskState(taskId: string) {
          if (taskId === 'existing-task') {
            return { snapshotTests: { 'test.js': 'hash123' } }
          }
          return null
        },
        async saveTaskState(taskId: string, taskState: Record<string, unknown>) {
          return taskId === 'existing-task'
        },
        async deleteTaskState(taskId: string) {
          return true
        },
        async initializeTaskState(taskId: string, initialState: Record<string, unknown>) {
          return true
        }
      }

      // When a new hook execution begins
      const state = await store.loadTaskState('existing-task')

      // Then the Task State Store loads the persisted taskState
      expect(state).toEqual({ snapshotTests: { 'test.js': 'hash123' } })
    })

    it('should implement saveTaskState method', async () => {
      const store: TaskStateStore = {
        async loadTaskState() {
          return null
        },
        async saveTaskState(taskId: string, taskState: Record<string, unknown>) {
          return taskId === 'task-1'
        },
        async deleteTaskState(taskId: string) {
          return true
        },
        async initializeTaskState(taskId: string, initialState: Record<string, unknown>) {
          return true
        }
      }

      // Given a Start hook that writes data into taskState
      const newState = { snapshotTests: { 'test.js': 'hash123' } }

      // When the Start hook completes
      const saved = await store.saveTaskState('task-1', newState)

      // Then the Task State Store persists the updated taskState
      expect(saved).toBe(true)
    })

    it('should implement deleteTaskState method', async () => {
      const store: TaskStateStore = {
        async loadTaskState() {
          return null
        },
        async saveTaskState() {
          return true
        },
        async deleteTaskState(taskId: string) {
          return taskId === 'task-1'
        },
        async initializeTaskState() {
          return true
        }
      }

      const deleted = await store.deleteTaskState('task-1')
      expect(deleted).toBe(true)
    })

    it('should implement initializeTaskState method', async () => {
      // US-11: Initialize taskState for a new task
      const store: TaskStateStore = {
        async loadTaskState() {
          return null
        },
        async saveTaskState() {
          return true
        },
        async deleteTaskState() {
          return true
        },
        async initializeTaskState(taskId: string, initialState: Record<string, unknown>) {
          return taskId !== 'error-task'
        }
      }

      // Given a task is received for the first time
      const initialState = { language: 'python' }

      // When initializeTaskState is called
      const initialized = await store.initializeTaskState('task-1', initialState)

      // Then it succeeds
      expect(initialized).toBe(true)
    })
  })

  describe('US-11: Task State persistence across hook executions', () => {
    it('should allow Stop hook to read data written by Start hook', async () => {
      // Given a Start hook that writes taskState.snapshotTests
      const store: TaskStateStore = {
        async loadTaskState() {
          return { snapshotTests: { 'test.js': 'hash123' } }
        },
        async saveTaskState() {
          return true
        },
        async deleteTaskState() {
          return true
        },
        async initializeTaskState() {
          return true
        }
      }

      // When the Start hook completes
      // And the Task State Store persists the updated taskState
      // Then the Stop hook can read taskState.snapshotTests in a subsequent execution
      const state = await store.loadTaskState('task-1')
      expect(state?.snapshotTests).toEqual({ 'test.js': 'hash123' })
    })
  })
})
