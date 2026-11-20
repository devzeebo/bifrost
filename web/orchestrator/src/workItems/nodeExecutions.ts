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

export type NodeExecutionFace =
  | 'pending'
  | 'claimed'
  | 'running'
  | 'executing'
  | 'needs-attention'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'waiting'

export type WaitingConnection = {
  readonly connectionId: string
  readonly inputPortName: string
  readonly feederNodeId: string
  readonly feederNodeName: string
  readonly feederStatus: TrackedWorkItemStatus | 'unissued'
  readonly feederWorkItemId: string | null
}

export type NodeExecutionRow = {
  readonly workItemId: string | null
  readonly nodeId: string | null
  readonly nodeName: string | null
  readonly face: NodeExecutionFace
  readonly status: TrackedWorkItemStatus | 'waiting'
  readonly issuedInputs: unknown
  readonly producedOutputs: unknown
  readonly failureReason: string | null
  readonly holderId: string | null
  readonly waitingOn: readonly WaitingConnection[]
}

export type WorkflowSnapshotSummary = {
  readonly id: string
  readonly name: string
  readonly version: number
}

export type WorkflowSnapshotGraph = WorkflowSnapshotSummary & {
  readonly nodes: readonly SnapshotNode[]
  readonly connections: readonly SnapshotConnection[]
}

type SnapshotPort = {
  readonly id: string
  readonly name: string
}

type SnapshotNode = {
  readonly id: string
  readonly name: string
  readonly style: string | null
  readonly inputs: readonly SnapshotPort[]
  readonly outputs: readonly SnapshotPort[]
}

type SnapshotConnection = {
  readonly id: string
  readonly outputPortId: string
  readonly inputPortId: string
}

export const readWorkflowSnapshot = (
  metadata: Readonly<Record<string, unknown>>,
): WorkflowSnapshotSummary | null => {
  const graph = readWorkflowSnapshotGraph(metadata)
  if (graph === null) {
    return null
  }
  return { id: graph.id, name: graph.name, version: graph.version }
}

export const readWorkflowSnapshotGraph = (
  metadata: Readonly<Record<string, unknown>>,
): WorkflowSnapshotGraph | null => {
  const raw = metadata[WORK_ITEM_METADATA_WORKFLOW_SNAPSHOT_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.version !== 'number' ||
    !Array.isArray(record.nodes) ||
    !Array.isArray(record.connections)
  ) {
    return null
  }

  const nodes: SnapshotNode[] = []
  for (const entry of record.nodes) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }
    const node = entry as Record<string, unknown>
    if (typeof node.id !== 'string' || typeof node.name !== 'string') {
      continue
    }
    const definition =
      node.definition && typeof node.definition === 'object' && !Array.isArray(node.definition)
        ? (node.definition as Record<string, unknown>)
        : null
    nodes.push({
      id: node.id,
      name: node.name,
      style: typeof definition?.style === 'string' ? definition.style : null,
      inputs: readPorts(node.inputs),
      outputs: readPorts(node.outputs),
    })
  }

  const connections: SnapshotConnection[] = []
  for (const entry of record.connections) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }
    const connection = entry as Record<string, unknown>
    if (
      typeof connection.id !== 'string' ||
      typeof connection.outputPortId !== 'string' ||
      typeof connection.inputPortId !== 'string'
    ) {
      continue
    }
    connections.push({
      id: connection.id,
      outputPortId: connection.outputPortId,
      inputPortId: connection.inputPortId,
    })
  }

  return {
    id: record.id,
    name: record.name,
    version: record.version,
    nodes,
    connections,
  }
}

export const fetchNodeExecutionsForRoot = async (
  rootWorkItemId: string,
  rootMetadata?: Readonly<Record<string, unknown>>,
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

  const settled: PromiseSettledResult<NodeExecutionRow | null>[] = await Promise.allSettled(
    ids.map(async (id): Promise<NodeExecutionRow | null> => {
      let ledger: LedgerWorkItem
      try {
        ledger = await fetchLedgerWorkItem(id)
      } catch {
        return null
      }

      // Incomplete draft: ledger exists before tracking is created.
      let tracked: TrackedWorkItem | null = null
      try {
        tracked = await fetchTrackedWorkItem(id)
      } catch {
        tracked = null
      }

      const status = tracked?.status ?? 'pending'
      const nodeId = ledger.metadata[WORK_ITEM_METADATA_NODE_ID_KEY]
      const nodeName = ledger.metadata[WORK_ITEM_METADATA_NODE_NAME_KEY]
      const failureReason =
        status === 'failed' || status === 'canceled'
          ? await fetchLatestStatusReason(id)
          : null
      return {
        workItemId: id,
        nodeId: typeof nodeId === 'string' ? nodeId : null,
        nodeName: typeof nodeName === 'string' ? nodeName : null,
        face: status,
        status,
        issuedInputs: ledger.metadata[WORK_ITEM_METADATA_ISSUED_INPUTS_KEY] ?? null,
        producedOutputs: ledger.metadata[WORK_ITEM_METADATA_PRODUCED_OUTPUTS_KEY] ?? null,
        failureReason,
        holderId: tracked?.holderId ?? null,
        waitingOn: [],
      } satisfies NodeExecutionRow
    }),
  )

  const issued = settled
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((row): row is NodeExecutionRow => row !== null)
  if (issued.length < ids.length) {
    throw new Error('Failed to load node executions')
  }

  const metadata =
    rootMetadata ??
    (await fetchLedgerWorkItem(rootWorkItemId).then((ledger) => ledger.metadata).catch(() => null))
  if (metadata === null) {
    return issued
  }

  return mergeBlockedRows(readWorkflowSnapshotGraph(metadata), issued)
}

export const mergeBlockedRows = (
  snapshot: WorkflowSnapshotGraph | null,
  issued: readonly NodeExecutionRow[],
): readonly NodeExecutionRow[] => {
  if (snapshot === null) {
    return issued
  }

  const issuedByNodeId = new Map(
    issued
      .filter((row) => row.nodeId !== null)
      .map((row) => [row.nodeId as string, row] as const),
  )
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node] as const))
  const nodeByOutputPort = new Map<string, SnapshotNode>()
  for (const node of snapshot.nodes) {
    for (const port of node.outputs) {
      nodeByOutputPort.set(port.id, node)
    }
  }

  const blocked: NodeExecutionRow[] = []
  for (const node of snapshot.nodes) {
    if (node.style === 'work-item-input' || issuedByNodeId.has(node.id)) {
      continue
    }
    const inbound = snapshot.connections.filter((connection) =>
      node.inputs.some((port) => port.id === connection.inputPortId),
    )
    if (inbound.length === 0) {
      continue
    }

    const waitingOn: WaitingConnection[] = inbound.map((connection) => {
      const inputPort = node.inputs.find((port) => port.id === connection.inputPortId)
      const feeder = nodeByOutputPort.get(connection.outputPortId)
      const feederExecution = feeder ? issuedByNodeId.get(feeder.id) : undefined
      return {
        connectionId: connection.id,
        inputPortName: inputPort?.name ?? connection.inputPortId,
        feederNodeId: feeder?.id ?? connection.outputPortId,
        feederNodeName: feeder?.name ?? 'feeder',
        feederStatus: feederExecution?.status === 'waiting'
          ? 'unissued'
          : (feederExecution?.status ?? 'unissued'),
        feederWorkItemId: feederExecution?.workItemId ?? null,
      }
    })

    blocked.push({
      workItemId: null,
      nodeId: node.id,
      nodeName: node.name,
      face: 'waiting',
      status: 'waiting',
      issuedInputs: null,
      producedOutputs: null,
      failureReason: null,
      holderId: null,
      waitingOn,
    })
  }

  void nodeById
  return [...issued, ...blocked]
}

const readPorts = (raw: unknown): readonly SnapshotPort[] => {
  if (!Array.isArray(raw)) {
    return []
  }
  const ports: SnapshotPort[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }
    const port = entry as Record<string, unknown>
    if (typeof port.id === 'string' && typeof port.name === 'string') {
      ports.push({ id: port.id, name: port.name })
    }
  }
  return ports
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
    const terminal = [...(body.changes ?? [])]
      .reverse()
      .find(
        (change) =>
          (change.status === 'failed' || change.status === 'canceled') &&
          typeof change.reason === 'string' &&
          change.reason.length > 0,
      )
    return terminal?.reason ?? null
  } catch {
    return null
  }
}
