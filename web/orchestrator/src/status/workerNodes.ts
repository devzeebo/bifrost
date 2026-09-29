export type WorkerNode = {
  readonly id: string
  readonly isAvailable: boolean
  readonly isOnline: boolean
  readonly lastHeartbeatAt: string | null
}

export class WorkerListError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerListError'
  }
}

export const fetchWorkerNodes = async (): Promise<readonly WorkerNode[]> => {
  const response = await fetch('/list-worker-nodes', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new WorkerListError(`Orchestrator returned ${response.status}`)
  }
  return parseWorkerNodes(await response.json())
}

const parseWorkerNodes = (value: unknown): readonly WorkerNode[] => {
  if (!Array.isArray(value)) {
    throw new WorkerListError('Worker list response was not a list of nodes')
  }
  return value.map(parseWorkerNode)
}

const parseWorkerNode = (value: unknown): WorkerNode => {
  if (!isRecord(value)) {
    throw new WorkerListError('Worker list response was not a list of nodes')
  }
  const id = value['id']
  const isAvailable = value['isAvailable']
  const isOnline = value['isOnline']
  const lastHeartbeatAt = value['lastHeartbeatAt']
  if (typeof id !== 'string' || typeof isAvailable !== 'boolean' || typeof isOnline !== 'boolean') {
    throw new WorkerListError('Worker list response was not a list of nodes')
  }
  if (lastHeartbeatAt !== undefined && lastHeartbeatAt !== null && typeof lastHeartbeatAt !== 'string') {
    throw new WorkerListError('Worker list response was not a list of nodes')
  }
  return {
    id,
    isAvailable,
    isOnline,
    lastHeartbeatAt: typeof lastHeartbeatAt === 'string' ? lastHeartbeatAt : null,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
