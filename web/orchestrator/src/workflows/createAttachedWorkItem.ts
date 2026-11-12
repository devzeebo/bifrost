import { WorkflowApiError, WorkflowNotFoundError, WorkflowValidationError } from './api'

export type CreateAttachedWorkItemInput = {
  readonly workItemId: string
  readonly workflowId: string
  readonly data: unknown
  readonly status?: string
  readonly actor?: string
  readonly reason?: string
}

export const createAttachedWorkItem = async (
  input: CreateAttachedWorkItemInput,
): Promise<void> => {
  const response = await fetch('/create-attached-work-item', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      workItemId: input.workItemId,
      workflowId: input.workflowId,
      data: input.data,
      status: input.status ?? 'pending',
      actor: input.actor ?? 'orchestrator-ui',
      reason: input.reason ?? 'submitted from status',
    }),
  })
  if (response.ok) {
    return
  }
  const detail = await readErrorDetail(response)
  if (response.status === 400) {
    throw new WorkflowValidationError(detail)
  }
  if (response.status === 404) {
    throw new WorkflowNotFoundError(detail)
  }
  throw new WorkflowApiError(detail)
}

const readErrorDetail = async (response: Response): Promise<string> => {
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
  return `Workflows returned ${response.status}`
}
