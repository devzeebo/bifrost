export type TrackedWorkItemStatus =
  | 'pending'
  | 'claimed'
  | 'running'
  | 'executing'
  | 'needs-attention'
  | 'succeeded'
  | 'failed'
  | 'canceled'

export type TrackedWorkItem = {
  readonly id: string
  readonly status: TrackedWorkItemStatus
  readonly holderId: string | null
}

export type RunOutcome = 'succeeded' | 'failed' | 'abandoned'

export type WorkItemRun = {
  readonly id: string
  readonly workItemId: string
  readonly position: number
  readonly createdAt: string
  readonly outcome: RunOutcome | null
}

export const isActiveStatus = (
  status: TrackedWorkItemStatus,
): status is 'pending' | 'claimed' | 'running' | 'executing' | 'needs-attention' =>
  status === 'pending' ||
  status === 'claimed' ||
  status === 'running' ||
  status === 'executing' ||
  status === 'needs-attention'

export const isHeldStatus = (
  status: TrackedWorkItemStatus,
): status is 'claimed' | 'running' => status === 'claimed' || status === 'running'
