import { createAttachedWorkItem } from '../workflows/createAttachedWorkItem'
import { createTrackedWorkItem } from './createTrackedWorkItem'

export type SubmitWorkflowWorkItemInput = {
  readonly workflowId: string
  readonly data: unknown
  readonly workItemId?: string
}

export type SubmitWorkflowWorkItemResult = {
  readonly workItemId: string
}

export const submitWorkflowWorkItem = async (
  input: SubmitWorkflowWorkItemInput,
): Promise<SubmitWorkflowWorkItemResult> => {
  const workItemId = input.workItemId ?? crypto.randomUUID()
  await createAttachedWorkItem({
    workItemId,
    workflowId: input.workflowId,
    data: input.data,
  })
  await createTrackedWorkItem({ id: workItemId })
  return { workItemId }
}
