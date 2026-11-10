import { parseTrackedWorkItemList, TrackedWorkItemError } from './parse'
import type { TrackedWorkItem } from './types'

export const fetchPendingWorkItems = async (): Promise<readonly TrackedWorkItem[]> => {
  const response = await fetch('/list-pending-tracked-work-items', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new TrackedWorkItemError(`Orchestrator returned ${response.status}`)
  }
  return parseTrackedWorkItemList(await response.json())
}
