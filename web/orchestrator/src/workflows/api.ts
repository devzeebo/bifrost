import type {
  WorkflowConnection,
  WorkflowDetail,
  WorkflowDrawing,
  WorkflowNode,
  WorkflowPort,
  WorkflowSummary,
} from './types'

export class WorkflowApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowApiError'
  }
}

export class WorkflowNotFoundError extends WorkflowApiError {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowNotFoundError'
  }
}

export class WorkflowValidationError extends WorkflowApiError {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowValidationError'
  }
}

export class WorkflowConflictError extends WorkflowApiError {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowConflictError'
  }
}

export const listWorkflows = async (): Promise<readonly WorkflowSummary[]> => {
  const response = await fetch('/list-workflows', {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!response.ok) {
    throw new WorkflowApiError(await readErrorDetail(response))
  }
  return parseWorkflowList(await response.json())
}

export const getWorkflow = async (id: string): Promise<WorkflowDetail> => {
  const response = await fetch(`/get-workflow/${id}`, {
    method: 'QUERY',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (response.status === 404) {
    throw new WorkflowNotFoundError(await readErrorDetail(response))
  }
  if (!response.ok) {
    throw new WorkflowApiError(await readErrorDetail(response))
  }
  return parseWorkflowDetail(await response.json())
}

export const createWorkflow = async (drawing: WorkflowDrawing): Promise<void> => {
  await postEmpty('/create-workflow', serializeDrawing(drawing))
}

export const saveWorkflow = async (input: {
  readonly drawing: WorkflowDrawing
  readonly expectedVersion: number
  readonly overwrite?: boolean
}): Promise<void> => {
  await postEmpty('/save-workflow', {
    ...serializeDrawing(input.drawing),
    expectedVersion: input.expectedVersion,
    overwrite: input.overwrite ?? false,
  })
}

export const deleteWorkflow = async (id: string): Promise<void> => {
  await postEmpty('/delete-workflow', { id })
}

const serializeDrawing = (drawing: WorkflowDrawing) => ({
  id: drawing.id,
  name: drawing.name,
  nodes: drawing.nodes.map(serializeNode),
  connections: drawing.connections.map((connection) => ({
    id: connection.id,
    outputPortId: connection.outputPortId,
    inputPortId: connection.inputPortId,
  })),
})

const serializeNode = (node: WorkflowNode) => ({
  id: node.id,
  name: node.name,
  position: { x: node.position.x, y: node.position.y },
  inputs: node.inputs.map(serializePort),
  outputs: node.outputs.map(serializePort),
  definition: node.definition
    ? { style: node.definition.style, spec: node.definition.spec }
    : null,
})

const serializePort = (port: WorkflowPort) => ({
  id: port.id,
  name: port.name,
  schema: port.schema,
})

const postEmpty = async (path: string, body: unknown): Promise<void> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
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
  if (response.status === 409) {
    throw new WorkflowConflictError(detail)
  }
  throw new WorkflowApiError(detail)
}

const readErrorDetail = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body['detail'] === 'string' && body['detail'].trim() !== '') {
      return body['detail']
    }
  } catch {
    // Fall through when the body is not ProblemDetails JSON.
  }
  return `Workflows returned ${response.status}`
}

export const parseWorkflowList = (value: unknown): readonly WorkflowSummary[] => {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    throw new WorkflowApiError('Workflow list response was invalid')
  }
  return value['items'].map((item) => {
    if (!isRecord(item) || typeof item['id'] !== 'string' || typeof item['name'] !== 'string') {
      throw new WorkflowApiError('Workflow list item was invalid')
    }
    return { id: item['id'], name: item['name'] }
  })
}

export const parseWorkflowDetail = (value: unknown): WorkflowDetail => {
  if (!isRecord(value)) {
    throw new WorkflowApiError('Workflow response was invalid')
  }
  const id = value['id']
  const name = value['name']
  const version = value['version']
  if (typeof id !== 'string' || typeof name !== 'string' || !isFiniteNumber(version)) {
    throw new WorkflowApiError('Workflow response was invalid')
  }
  return {
    id,
    name,
    version,
    nodes: parseNodes(value['nodes']),
    connections: parseConnections(value['connections']),
  }
}

const parseNodes = (value: unknown): readonly WorkflowNode[] => {
  if (!Array.isArray(value)) {
    throw new WorkflowApiError('Workflow nodes were invalid')
  }
  return value.map((node) => {
    if (!isRecord(node)) {
      throw new WorkflowApiError('Workflow node was invalid')
    }
    const id = node['id']
    const name = node['name']
    const position = node['position']
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      !isRecord(position) ||
      !isFiniteNumber(position['x']) ||
      !isFiniteNumber(position['y'])
    ) {
      throw new WorkflowApiError('Workflow node was invalid')
    }
    return {
      id,
      name,
      position: { x: position['x'], y: position['y'] },
      inputs: parsePorts(node['inputs']),
      outputs: parsePorts(node['outputs']),
      definition: parseDefinition(node['definition']),
    }
  })
}

const parsePorts = (value: unknown): readonly WorkflowPort[] => {
  if (!Array.isArray(value)) {
    throw new WorkflowApiError('Workflow ports were invalid')
  }
  return value.map((port) => {
    if (!isRecord(port) || typeof port['id'] !== 'string' || typeof port['name'] !== 'string') {
      throw new WorkflowApiError('Workflow port was invalid')
    }
    if (!('schema' in port)) {
      throw new WorkflowApiError('Workflow port was invalid')
    }
    return {
      id: port['id'],
      name: port['name'],
      schema: port['schema'],
    }
  })
}

const parseDefinition = (value: unknown): WorkflowNode['definition'] => {
  if (value === null || value === undefined) {
    return null
  }
  if (!isRecord(value)) {
    throw new WorkflowApiError('Workflow definition was invalid')
  }
  const style = value['style']
  if (style !== null && style !== undefined && typeof style !== 'string') {
    throw new WorkflowApiError('Workflow definition was invalid')
  }
  return {
    style: typeof style === 'string' ? style : null,
    spec: value['spec'] ?? null,
  }
}

const parseConnections = (value: unknown): readonly WorkflowConnection[] => {
  if (!Array.isArray(value)) {
    throw new WorkflowApiError('Workflow connections were invalid')
  }
  return value.map((connection) => {
    if (
      !isRecord(connection) ||
      typeof connection['id'] !== 'string' ||
      typeof connection['outputPortId'] !== 'string' ||
      typeof connection['inputPortId'] !== 'string'
    ) {
      throw new WorkflowApiError('Workflow connection was invalid')
    }
    return {
      id: connection['id'],
      outputPortId: connection['outputPortId'],
      inputPortId: connection['inputPortId'],
    }
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
