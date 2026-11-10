import { parseWorkItemRunList, TrackedWorkItemError } from './parse'
import type { WorkItemRun } from './types'

export const fetchRunsForWorkItem = async (
  workItemId: string,
): Promise<readonly WorkItemRun[]> => {
  const response = await fetch('/list-runs-for-work-item', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ workItemId }),
  })
  if (!response.ok) {
    throw new TrackedWorkItemError(`Orchestrator returned ${response.status}`)
  }
  return parseWorkItemRunList(await response.json())
}
