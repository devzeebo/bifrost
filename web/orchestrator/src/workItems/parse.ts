import type { TrackedWorkItem, TrackedWorkItemStatus, WorkItemRun, RunOutcome } from './types'

export class TrackedWorkItemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrackedWorkItemError'
  }
}

const statuses = new Set<TrackedWorkItemStatus>([
  'pending',
  'claimed',
  'running',
  'executing',
  'needs-attention',
  'succeeded',
  'failed',
  'canceled',
])

const outcomes = new Set<RunOutcome>(['succeeded', 'failed', 'abandoned'])

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const parseTrackedWorkItem = (value: unknown): TrackedWorkItem => {
  if (!isRecord(value)) {
    throw new TrackedWorkItemError('Tracked work item was not an object')
  }
  const id = value['id']
  const status = value['status']
  const holderId = value['holderId']
  if (typeof id !== 'string' || typeof status !== 'string' || !statuses.has(status as TrackedWorkItemStatus)) {
    throw new TrackedWorkItemError('Tracked work item was incomplete')
  }
  if (holderId !== undefined && holderId !== null && typeof holderId !== 'string') {
    throw new TrackedWorkItemError('Tracked work item holder was invalid')
  }
  return {
    id,
    status: status as TrackedWorkItemStatus,
    holderId: typeof holderId === 'string' ? holderId : null,
  }
}

export const parseTrackedWorkItemList = (value: unknown): readonly TrackedWorkItem[] => {
  if (!isRecord(value)) {
    throw new TrackedWorkItemError('Tracked work item list was not an object')
  }
  const items = value['items']
  if (!Array.isArray(items)) {
    throw new TrackedWorkItemError('Tracked work item list was missing items')
  }
  return items.map(parseTrackedWorkItem)
}

export const parseWorkItemRun = (value: unknown): WorkItemRun => {
  if (!isRecord(value)) {
    throw new TrackedWorkItemError('Run was not an object')
  }
  const id = value['id']
  const workItemId = value['workItemId']
  const position = value['position']
  const createdAt = value['createdAt']
  const outcome = value['outcome']
  if (
    typeof id !== 'string' ||
    typeof workItemId !== 'string' ||
    typeof position !== 'number' ||
    typeof createdAt !== 'string'
  ) {
    throw new TrackedWorkItemError('Run was incomplete')
  }
  if (outcome !== undefined && outcome !== null) {
    if (typeof outcome !== 'string' || !outcomes.has(outcome as RunOutcome)) {
      throw new TrackedWorkItemError('Run outcome was invalid')
    }
  }
  return {
    id,
    workItemId,
    position,
    createdAt,
    outcome: typeof outcome === 'string' ? (outcome as RunOutcome) : null,
  }
}

export const parseWorkItemRunList = (value: unknown): readonly WorkItemRun[] => {
  if (!isRecord(value)) {
    throw new TrackedWorkItemError('Run list was not an object')
  }
  const items = value['items']
  if (!Array.isArray(items)) {
    throw new TrackedWorkItemError('Run list was missing items')
  }
  return items.map(parseWorkItemRun)
}
