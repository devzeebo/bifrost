import { parseTrackedWorkItemList, TrackedWorkItemError } from './parse'
import type { TrackedWorkItem } from './types'

export const fetchHeldWorkItems = async (
  workerId: string,
): Promise<readonly TrackedWorkItem[]> => {
  const response = await fetch(`/list-tracked-work-items-held-by/${workerId}`, {
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
