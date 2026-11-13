import { fetchLedgerWorkItem, type LedgerWorkItem } from './ledgerWorkItem'
import { fetchTrackedWorkItem } from './trackedWorkItem'
import type { TrackedWorkItem, TrackedWorkItemStatus } from './types'

export const WORK_ITEM_METADATA_ROOT_WORK_ITEM_ID_KEY = 'rootWorkItemId'
export const WORK_ITEM_METADATA_NODE_ID_KEY = 'nodeId'
export const WORK_ITEM_METADATA_NODE_NAME_KEY = 'nodeName'
export const WORK_ITEM_METADATA_ISSUED_INPUTS_KEY = 'issuedInputs'
export const WORK_ITEM_METADATA_WORKFLOW_SNAPSHOT_KEY = 'workflowSnapshot'
export const WORK_ITEM_METADATA_WORKFLOW_VERSION_KEY = 'workflowVersion'

export type NodeExecutionRow = {
  readonly workItemId: string
  readonly nodeId: string | null
  readonly nodeName: string | null
  readonly status: TrackedWorkItemStatus
  readonly issuedInputs: unknown
  readonly holderId: string | null
}

export type WorkflowSnapshotSummary = {
  readonly id: string
  readonly name: string
  readonly version: number
}

export const readWorkflowSnapshot = (
  metadata: Readonly<Record<string, unknown>>,
): WorkflowSnapshotSummary | null => {
  const raw = metadata[WORK_ITEM_METADATA_WORKFLOW_SNAPSHOT_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.version !== 'number'
  ) {
    return null
  }
  return { id: record.id, name: record.name, version: record.version }
}

export const fetchNodeExecutionsForRoot = async (
  rootWorkItemId: string,
): Promise<readonly NodeExecutionRow[]> => {
  const response = await fetch('/list-work-items', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      metadata: { [WORK_ITEM_METADATA_ROOT_WORK_ITEM_ID_KEY]: rootWorkItemId },
    }),
  })
  if (!response.ok) {
    throw new Error(`Work items returned ${response.status}`)
  }
  const body = (await response.json()) as { items?: readonly { id?: string }[] }
  const ids = (body.items ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string')

  const rows = await Promise.all(
    ids.map(async (id) => {
      const [ledger, tracked]: [LedgerWorkItem, TrackedWorkItem] = await Promise.all([
        fetchLedgerWorkItem(id),
        fetchTrackedWorkItem(id),
      ])
      const nodeId = ledger.metadata[WORK_ITEM_METADATA_NODE_ID_KEY]
      const nodeName = ledger.metadata[WORK_ITEM_METADATA_NODE_NAME_KEY]
      return {
        workItemId: id,
        nodeId: typeof nodeId === 'string' ? nodeId : null,
        nodeName: typeof nodeName === 'string' ? nodeName : null,
        status: tracked.status,
        issuedInputs: ledger.metadata[WORK_ITEM_METADATA_ISSUED_INPUTS_KEY] ?? null,
        holderId: tracked.holderId,
      } satisfies NodeExecutionRow
    }),
  )

  return rows.sort((a, b) => a.workItemId.localeCompare(b.workItemId))
}
