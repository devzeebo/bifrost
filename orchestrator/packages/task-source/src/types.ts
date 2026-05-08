// Task Status enum - used by task source implementations internally
export const TaskStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

// Minimal Task type - orchestrator treats metadata as opaque
export type Task = {
  id: string;
  agentId: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

// FR-1: TaskDetail extends Task
export type TaskDetail = Task & {
  dependencies: DependencyRef[];
  notes: NoteEntry[];
  acceptanceCriteria: ACEntry[];
  retro: RetroEntry[];
};

export type DependencyRef = {
  taskId: string;
  type: string;
};

export type NoteEntry = {
  id: string;
  content: string;
  createdAt: Date;
};

export type ACEntry = {
  id: string;
  criteria: string;
  satisfied: boolean;
};

export type RetroEntry = {
  id: string;
  content: string;
  createdAt: Date;
};
