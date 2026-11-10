import { TrackedWorkItemError } from './parse'
import type { TrackedWorkItemStatus } from './types'

export type ReleaseTrackedWorkItemInput = {
  readonly id: string
  readonly status: TrackedWorkItemStatus
  readonly reason?: string
}

export const releaseTrackedWorkItem = async (
  input: ReleaseTrackedWorkItemInput,
): Promise<void> => {
  const response = await fetch('/release-tracked-work-item', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: input.id,
      actor: 'orchestrator-ui',
      reason: input.reason ?? 'Released from orchestrator UI',
      expected: { status: input.status },
    }),
  })
  if (!response.ok) {
    throw new TrackedWorkItemError(`Orchestrator returned ${response.status}`)
  }
}
