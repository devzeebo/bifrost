import { TrackedWorkItemError } from './parse'

export type CreateTrackedWorkItemInput = {
  readonly id: string
  readonly actor?: string
  readonly reason?: string
}

export const createTrackedWorkItem = async (
  input: CreateTrackedWorkItemInput,
): Promise<void> => {
  const response = await fetch('/create-tracked-work-item', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: input.id,
      actor: input.actor ?? 'orchestrator-ui',
      reason: input.reason ?? 'submitted from status',
    }),
  })
  if (!response.ok) {
    throw new TrackedWorkItemError(await readErrorDetail(response, 'Orchestrator'))
  }
}

const readErrorDetail = async (response: Response, service: string): Promise<string> => {
  try {
    const body: unknown = await response.json()
    if (
      body &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof (body as { detail: unknown }).detail === 'string' &&
      (body as { detail: string }).detail.trim() !== ''
    ) {
      return (body as { detail: string }).detail
    }
  } catch {
    // Fall through when the body is not ProblemDetails JSON.
  }
  return `${service} returned ${response.status}`
}
