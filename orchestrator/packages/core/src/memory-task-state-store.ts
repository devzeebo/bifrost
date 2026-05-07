import type { TaskStateStore } from './task-state-store.js'

/**
 * In-memory Task State Store implementation.
 * Useful for testing and single-process scenarios.
 *
 * Note: This implementation is not persistent across process restarts.
 * For production, use Redis, file-based, or database-backed implementations.
 */
export class MemoryTaskStateStore implements TaskStateStore {
  #store: Map<string, Record<string, unknown>>

  constructor() {
    this.#store = new Map()
  }

  async loadTaskState(taskId: string): Promise<Record<string, unknown> | null> {
    return this.#store.get(taskId) ?? null
  }

  async saveTaskState(
    taskId: string,
    taskState: Record<string, unknown>
  ): Promise<boolean> {
    this.#store.set(taskId, { ...taskState })
    return true
  }

  async deleteTaskState(taskId: string): Promise<boolean> {
    return this.#store.delete(taskId)
  }

  async initializeTaskState(
    taskId: string,
    initialState: Record<string, unknown>
  ): Promise<boolean> {
    // Only initialize if not already present
    if (!this.#store.has(taskId)) {
      this.#store.set(taskId, { ...initialState })
      return true
    }
    return false
  }

  /**
   * Clear all stored task states.
   * Useful for testing.
   */
  clear(): void {
    this.#store.clear()
  }

  /**
   * Get the number of stored task states.
   */
  get size(): number {
    return this.#store.size
  }
}
