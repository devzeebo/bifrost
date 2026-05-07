import { Task, TaskDetail } from './types.js'

// FR-1: Task Source Interface
export type TaskSource = {
  // Yield available tasks. Task source responsible for coordination.
  watchTasks: () => AsyncGenerator<Task>

  // Retrieve full task details
  getTaskDetail: (taskId: string) => Promise<TaskDetail | null>

  // Mark task as fulfilled
  completeTask: (taskId: string) => Promise<boolean>

  // Mark task as failed
  failTask: (taskId: string, error: string) => Promise<boolean>
}
