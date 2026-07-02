export type Task = {
  id: string;
  scriptName: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type TaskSource = {
  watchTasks: () => AsyncGenerator<Task>;
  completeTask: (taskId: string) => Promise<void>;
  failTask: (taskId: string, error: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  setState: (taskId: string, taskState: Record<string, unknown>) => Promise<void>;
};
