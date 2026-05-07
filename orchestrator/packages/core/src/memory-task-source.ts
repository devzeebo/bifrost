import type { TaskSource, Task, TaskDetail, TaskStatus } from '@orchestrator/task-source'

/**
 * In-memory Task Source implementation.
 * Useful for testing and single-process scenarios.
 *
 * Note: This implementation provides basic coordination for single-process scenarios.
 * For distributed scenarios, use Redis, queue-based, or database-backed implementations.
 */
export class MemoryTaskSource implements TaskSource {
  #tasks: Map<string, TaskDetail>
  #pending: Set<string>
  #claimed: Set<string>

  constructor() {
    this.#tasks = new Map()
    this.#pending = new Set()
    this.#claimed = new Set()
  }

  /**
   * Add a task to the task source.
   */
  async addTask(task: Task): Promise<void> {
    const taskDetail: TaskDetail = {
      ...task,
      dependencies: [],
      notes: [],
      acceptanceCriteria: [],
      retro: []
    }

    this.#tasks.set(task.id, taskDetail)
    this.#pending.add(task.id)
  }

  /**
   * Yield available tasks via async iterator.
   * US-2: Task Source emits available tasks via async iterator
   *
   * This implementation provides basic coordination by tracking claimed tasks.
   * In distributed scenarios, use proper locking or queue semantics.
   */
  async *watchTasks(): AsyncGenerator<Task> {
    // Poll for available tasks
    // Continue while there are pending or claimed tasks (tasks being processed)
    let iterations = 0
    const maxIterations = 10 // Prevent infinite loops in tests

    while (this.#pending.size > 0 || this.#claimed.size > 0) {
      // Find first unclaimed pending task
      for (const taskId of this.#pending) {
        if (!this.#claimed.has(taskId)) {
          const task = this.#tasks.get(taskId)
          if (task && task.status === 'OPEN') {
            // Mark as claimed
            this.#claimed.add(taskId)

            // Update task status
            task.status = 'IN_PROGRESS' as TaskStatus
            task.claimant = 'memory-source'

            yield {
              id: task.id,
              title: task.title,
              description: task.description,
              status: task.status,
              tags: task.tags,
              claimant: task.claimant,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
              priority: task.priority
            }

            // Return after yielding one task
            return
          }
        }
      }

      // No tasks available, wait a bit before polling again
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Safety check for tests
      iterations++
      if (iterations > maxIterations) {
        break
      }
    }
  }

  async getTaskDetail(taskId: string): Promise<TaskDetail | null> {
    return this.#tasks.get(taskId) ?? null
  }

  async completeTask(taskId: string): Promise<boolean> {
    const task = this.#tasks.get(taskId)
    if (!task) {
      return false
    }

    task.status = 'COMPLETED' as TaskStatus
    this.#pending.delete(taskId)
    this.#claimed.delete(taskId)

    return true
  }

  async failTask(taskId: string, error: string): Promise<boolean> {
    const task = this.#tasks.get(taskId)
    if (!task) {
      return false
    }

    task.status = 'FAILED' as TaskStatus
    task.notes.push({
      id: `error-${Date.now()}`,
      content: error,
      createdAt: new Date()
    })

    this.#pending.delete(taskId)
    this.#claimed.delete(taskId)

    return true
  }

  /**
   * Get all tasks (useful for testing).
   */
  getAllTasks(): TaskDetail[] {
    return Array.from(this.#tasks.values())
  }

  /**
   * Clear all tasks (useful for testing).
   */
  clear(): void {
    this.#tasks.clear()
    this.#pending.clear()
    this.#claimed.clear()
  }
}
