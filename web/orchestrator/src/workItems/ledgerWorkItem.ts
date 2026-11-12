import { WORK_ITEM_METADATA_WORKFLOW_ID_KEY } from '../workflows/drawing'

export class LedgerWorkItemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerWorkItemError'
  }
}

export type LedgerWorkItem = {
  readonly id: string
  readonly status: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly attachedWorkflowId: string | null
}

export const fetchLedgerWorkItem = async (id: string): Promise<LedgerWorkItem> => {
  const response = await fetch(`/get-work-item/${id}`, {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new LedgerWorkItemError(`Work items returned ${response.status}`)
  }
  return parseLedgerWorkItem(await response.json())
}

export const parseLedgerWorkItem = (raw: unknown): LedgerWorkItem => {
  if (!raw || typeof raw !== 'object') {
    throw new LedgerWorkItemError('Invalid work item payload')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.status !== 'string') {
    throw new LedgerWorkItemError('Invalid work item payload')
  }
  const metadata =
    record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : {}
  const attached = metadata[WORK_ITEM_METADATA_WORKFLOW_ID_KEY]
  return {
    id: record.id,
    status: record.status,
    metadata,
    attachedWorkflowId: typeof attached === 'string' ? attached : null,
  }
}
