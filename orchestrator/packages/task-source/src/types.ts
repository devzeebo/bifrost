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
export interface Task {
  id: string;
  agentId: string;
  taskState: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface DependencyRef {
  taskId: string;
  type: string;
}

export interface NoteEntry {
  id: string;
  content: string;
  createdAt: Date;
}

export interface ACEntry {
  id: string;
  criteria: string;
  satisfied: boolean;
}

export interface RetroEntry {
  id: string;
  content: string;
  createdAt: Date;
}
