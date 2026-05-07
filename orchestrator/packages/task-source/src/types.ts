// FR-1: Task Status enum values
export const TaskStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

// FR-1: Task aggregate
export type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  tags: string[]
  claimant: string | null
  createdAt: Date | null
  updatedAt: Date | null
  priority: number
}

// FR-1: TaskDetail extends Task
export type TaskDetail = Task & {
  dependencies: DependencyRef[]
  notes: NoteEntry[]
  acceptanceCriteria: ACEntry[]
  retro: RetroEntry[]
}

export type DependencyRef = {
  taskId: string
  type: string
}

export type NoteEntry = {
  id: string
  content: string
  createdAt: Date
}

export type ACEntry = {
  id: string
  criteria: string
  satisfied: boolean
}

export type RetroEntry = {
  id: string
  content: string
  createdAt: Date
}
