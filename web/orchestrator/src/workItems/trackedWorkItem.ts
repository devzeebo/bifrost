import { parseTrackedWorkItem, TrackedWorkItemError } from './parse'
import type { TrackedWorkItem } from './types'

export const fetchTrackedWorkItem = async (id: string): Promise<TrackedWorkItem> => {
  const response = await fetch(`/get-tracked-work-item/${id}`, {
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
  return parseTrackedWorkItem(await response.json())
}
