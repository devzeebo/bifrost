import { TrackedWorkItemError } from './parse'
import type { TrackedWorkItemStatus } from './types'

export type CancelTrackedWorkItemInput = {
  readonly id: string
  readonly status: TrackedWorkItemStatus
  readonly reason?: string
}

export const cancelTrackedWorkItem = async (
  input: CancelTrackedWorkItemInput,
): Promise<void> => {
  if (input.status === 'executing') {
    const response = await fetch('/cancel-attached-workflow-root', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        rootWorkItemId: input.id,
        actor: 'orchestrator-ui',
        reason: input.reason ?? 'Canceled from orchestrator UI',
      }),
    })
    if (!response.ok) {
      throw new TrackedWorkItemError(`Workflows returned ${response.status}`)
    }
    return
  }

  const response = await fetch('/cancel-tracked-work-item', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: input.id,
      actor: 'orchestrator-ui',
      reason: input.reason ?? 'Canceled from orchestrator UI',
      expected: { status: input.status },
    }),
  })
  if (!response.ok) {
    throw new TrackedWorkItemError(`Orchestrator returned ${response.status}`)
  }
}
