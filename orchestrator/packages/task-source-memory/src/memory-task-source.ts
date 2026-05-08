import type { TaskSource, Task } from '@orchestrator/task-source'

type InternalTask = {
  id: string
  agentId: string
  taskState: Record<string, unknown>
  metadata: Record<string, unknown>
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  error?: string
}

export class MemoryTaskSource implements TaskSource {
  #tasks: Map<string, InternalTask> = new Map()
  #pending: Set<string> = new Set()
  #claimed: Set<string> = new Set()

  async addTask(task: Omit<InternalTask, 'status'>): Promise<void> {
    const internalTask: InternalTask = {
      ...task,
      status: 'OPEN'
    }
    this.#tasks.set(task.id, internalTask)
    this.#pending.add(task.id)
  }

  async *watchTasks(): AsyncGenerator<Task> {
    const maxIterations = 100
    let iterations = 0

    while ((this.#pending.size > 0 || this.#claimed.size > 0) && iterations < maxIterations) {
      for (const taskId of this.#pending) {
        if (!this.#claimed.has(taskId)) {
          const task = this.#tasks.get(taskId)
          if (task && task.status === 'OPEN') {
            this.#claimed.add(taskId)
            task.status = 'IN_PROGRESS'

            yield {
              id: task.id,
              agentId: task.agentId,
              taskState: task.taskState,
              metadata: task.metadata
            }

            return
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 50))
      iterations++
    }
  }

  async completeTask(taskId: string): Promise<void> {
    const task = this.#tasks.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.status = 'COMPLETED'
    this.#pending.delete(taskId)
    this.#claimed.delete(taskId)
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.#tasks.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.status = 'FAILED'
    task.error = error
    this.#pending.delete(taskId)
    this.#claimed.delete(taskId)
  }

  async setState(taskId: string, taskState: Record<string, unknown>): Promise<void> {
    const task = this.#tasks.get(taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    task.taskState = { ...taskState }
  }

  getInternalTask(taskId: string): InternalTask | undefined {
    return this.#tasks.get(taskId)
  }

  getAllTasks(): InternalTask[] {
    return Array.from(this.#tasks.values())
  }

  clear(): void {
    this.#tasks.clear()
    this.#pending.clear()
    this.#claimed.clear()
  }
}
