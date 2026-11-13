import { fetchLedgerWorkItem, type LedgerWorkItem } from './ledgerWorkItem'
import { fetchTrackedWorkItem } from './trackedWorkItem'
import type { TrackedWorkItem, TrackedWorkItemStatus } from './types'

export const WORK_ITEM_METADATA_ROOT_WORK_ITEM_ID_KEY = 'rootWorkItemId'
export const WORK_ITEM_METADATA_NODE_ID_KEY = 'nodeId'
export const WORK_ITEM_METADATA_NODE_NAME_KEY = 'nodeName'
export const WORK_ITEM_METADATA_ISSUED_INPUTS_KEY = 'issuedInputs'
export const WORK_ITEM_METADATA_PRODUCED_OUTPUTS_KEY = 'producedOutputs'
export const WORK_ITEM_METADATA_WORKFLOW_SNAPSHOT_KEY = 'workflowSnapshot'
export const WORK_ITEM_METADATA_WORKFLOW_VERSION_KEY = 'workflowVersion'

export type NodeExecutionRow = {
  readonly workItemId: string
  readonly nodeId: string | null
  readonly nodeName: string | null
  readonly status: TrackedWorkItemStatus
  readonly issuedInputs: unknown
  readonly producedOutputs: unknown
  readonly failureReason: string | null
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
  // Preserve list order as issue order (do not sort by work-item id).
  const ids = (body.items ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string')

  const settled = await Promise.all(
    ids.map(async (id) => {
      try {
        const [ledger, tracked]: [LedgerWorkItem, TrackedWorkItem] = await Promise.all([
          fetchLedgerWorkItem(id),
          fetchTrackedWorkItem(id),
        ])
        const nodeId = ledger.metadata[WORK_ITEM_METADATA_NODE_ID_KEY]
        const nodeName = ledger.metadata[WORK_ITEM_METADATA_NODE_NAME_KEY]
        const failureReason =
          tracked.status === 'failed' || tracked.status === 'canceled'
            ? await fetchLatestStatusReason(id)
            : null
        return {
          workItemId: id,
          nodeId: typeof nodeId === 'string' ? nodeId : null,
          nodeName: typeof nodeName === 'string' ? nodeName : null,
          status: tracked.status,
          issuedInputs: ledger.metadata[WORK_ITEM_METADATA_ISSUED_INPUTS_KEY] ?? null,
          producedOutputs: ledger.metadata[WORK_ITEM_METADATA_PRODUCED_OUTPUTS_KEY] ?? null,
          failureReason,
          holderId: tracked.holderId,
        } satisfies NodeExecutionRow
      } catch {
        return null
      }
    }),
  )

  const rows = settled.filter((row): row is NodeExecutionRow => row !== null)
  if (ids.length > 0 && rows.length === 0) {
    throw new Error('Failed to load node executions')
  }

  return rows
}

const fetchLatestStatusReason = async (id: string): Promise<string | null> => {
  try {
    const response = await fetch(`/get-work-item-history/${id}`, {
      method: 'QUERY',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: '{}',
    })
    if (!response.ok) {
      return null
    }
    const body = (await response.json()) as {
      changes?: readonly { reason?: string; status?: string | null }[]
    }
    const withReason = [...(body.changes ?? [])]
      .reverse()
      .find((change) => typeof change.reason === 'string' && change.reason.length > 0)
    return withReason?.reason ?? null
  } catch {
    return null
  }
}
