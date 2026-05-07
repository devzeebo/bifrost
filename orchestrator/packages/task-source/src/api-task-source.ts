import type { TaskSource, Task, TaskDetail, TaskStatus } from './types.js'

export type APITaskSourceConfig = {
  baseUrl: string
  pollInterval?: number // milliseconds, default 10000
  headers?: Record<string, string>
  timeout?: number // request timeout in milliseconds, default 30000
}

/**
 * API-based Task Source implementation.
 * Polls an HTTP API endpoint for available tasks.
 *
 * US-2: Task Source emits available tasks via async iterator
 * FR-1: Task Source Interface
 */
export class APITaskSource implements TaskSource {
  #config: APITaskSourceConfig
  #abortController: AbortController | null = null

  constructor(config: APITaskSourceConfig) {
    this.#config = {
      pollInterval: 10000,
      timeout: 30000,
      ...config
    }
  }

  /**
   * Yield available tasks via async iterator.
   * US-2: Task Source emits available tasks via async iterator
   *
   * This method polls the API endpoint at the configured interval.
   * The API endpoint is responsible for coordination (claiming, locking).
   */
  async *watchTasks(): AsyncGenerator<Task> {
    this.#abortController = new AbortController()

    while (!this.#abortController.signal.aborted) {
      try {
        // FR-1: Yield available tasks from API
        const tasks = await this.#fetchTasks()

        for (const task of tasks) {
          yield task
        }
      } catch (error) {
        // Log error but continue polling (FR-15: reconnection)
        console.error('Error polling task source:', error)
      }

      // Wait before next poll
      await this.#delay(this.#config.pollInterval!)
    }
  }

  /**
   * Fetch tasks from the API.
   */
  async #fetchTasks(): Promise<Task[]> {
    const url = `${this.#config.baseUrl}/tasks?status=OPEN`

    const response = await fetch(url, {
      signal: this.#abortController?.signal,
      headers: this.#config.headers
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const tasks = await response.json()
    return tasks as Task[]
  }

  /**
   * Delay helper.
   */
  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Retrieve full task details.
   * FR-1: getTaskDetail method
   */
  async getTaskDetail(taskId: string): Promise<TaskDetail | null> {
    const url = `${this.#config.baseUrl}/tasks/${taskId}`

    const response = await fetch(url, {
      signal: this.#abortController?.signal,
      headers: this.#config.headers
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as TaskDetail
  }

  /**
   * Mark task as fulfilled.
   * FR-1: completeTask method
   */
  async completeTask(taskId: string): Promise<boolean> {
    const url = `${this.#config.baseUrl}/tasks/${taskId}/complete`

    const response = await fetch(url, {
      method: 'POST',
      signal: this.#abortController?.signal,
      headers: {
        ...this.#config.headers,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return true
  }

  /**
   * Mark task as failed.
   * FR-1: failTask method
   */
  async failTask(taskId: string, error: string): Promise<boolean> {
    const url = `${this.#config.baseUrl}/tasks/${taskId}/fail`

    const response = await fetch(url, {
      method: 'POST',
      signal: this.#abortController?.signal,
      headers: {
        ...this.#config.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return true
  }

  /**
   * Stop polling tasks.
   */
  close(): void {
    this.#abortController?.abort()
  }
}
