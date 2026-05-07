/**
 * FR-3: Task State Store Interface
 * US-11: Task State persistence across hook executions
 *
 * Task State Store implementations MUST be thread-safe and support concurrent access.
 * Each operation MUST be atomic. The orchestrator does not implement additional consistency mechanisms.
 */
export type TaskStateStore = {
  /**
   * Load taskState for a task.
   * US-11: When a new hook execution begins, the Task State Store loads the persisted taskState.
   */
  loadTaskState: (taskId: string) => Promise<Record<string, unknown> | null>

  /**
   * Persist taskState for a task.
   * US-11: When a hook completes successfully, the save operation persists taskState.
   * The save operation is atomic - either entire taskState is persisted or none is.
   */
  saveTaskState: (taskId: string, taskState: Record<string, unknown>) => Promise<boolean>

  /**
   * Delete taskState for a task.
   */
  deleteTaskState: (taskId: string) => Promise<boolean>

  /**
   * Initialize taskState for a new task.
   * US-11: When a task is received for the first time, initializeTaskState is called.
   */
  initializeTaskState: (taskId: string, initialState: Record<string, unknown>) => Promise<boolean>
}
