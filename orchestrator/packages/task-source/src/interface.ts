import { Task } from './types.js'

export type TaskSource = {
  // Yield tasks with ALL data needed
  watchTasks: () => AsyncGenerator<Task>

  // Report completion/failure
  completeTask: (taskId: string) => Promise<void>
  failTask: (taskId: string, error: string) => Promise<void>

  // Engine calls this to persist state updates during execution
  setState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>
}
