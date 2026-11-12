import type {
  NodeDefinition,
  WorkflowConnection,
  WorkflowDrawing,
  WorkflowNode,
  WorkflowPort,
} from './types'

export const WORK_ITEM_INPUT_STYLE = 'work-item-input'

export const WORK_ITEM_OUTPUT_SCHEMA = {
  $id: 'bifrost://work-item-output',
  title: 'Work item',
  type: 'object',
} as const

export const WORK_ITEM_METADATA_WORKFLOW_ID_KEY = 'workflowId'

export const isWorkItemInputNode = (node: WorkflowNode): boolean =>
  node.definition?.style === WORK_ITEM_INPUT_STYLE

export const createWorkItemInputNode = (input?: {
  readonly id?: string
  readonly outputPortId?: string
  readonly x?: number
  readonly y?: number
  readonly inputSchema?: unknown
}): WorkflowNode => ({
  id: input?.id ?? crypto.randomUUID(),
  name: 'Work item',
  position: { x: input?.x ?? 40, y: input?.y ?? 40 },
  inputs: [],
  outputs: [
    {
      id: input?.outputPortId ?? crypto.randomUUID(),
      name: 'work item',
      schema: { ...WORK_ITEM_OUTPUT_SCHEMA },
    },
  ],
  definition: {
    style: WORK_ITEM_INPUT_STYLE,
    spec: { inputSchema: input?.inputSchema ?? true },
  },
})

export const emptyDrawing = (id: string, name = 'Untitled workflow'): WorkflowDrawing => ({
  id,
  name,
  nodes: [createWorkItemInputNode()],
  connections: [],
})

export const snapshotDrawing = (drawing: WorkflowDrawing): string =>
  JSON.stringify({
    id: drawing.id,
    name: drawing.name,
    nodes: drawing.nodes,
    connections: drawing.connections,
  })

export const isDrawingDirty = (
  drawing: WorkflowDrawing,
  baselineSnapshot: string | null,
): boolean => baselineSnapshot !== null && snapshotDrawing(drawing) !== baselineSnapshot

export const createBlankNode = (input: {
  readonly id?: string
  readonly name?: string
  readonly x: number
  readonly y: number
}): WorkflowNode => {
  const inputPortId = crypto.randomUUID()
  const outputPortId = crypto.randomUUID()
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name ?? 'New node',
    position: { x: input.x, y: input.y },
    inputs: [blankPort(inputPortId, 'in')],
    outputs: [blankPort(outputPortId, 'out')],
    definition: {
      style: 'script',
      spec: { image: 'bifrost/node', body: '' },
    },
  }
}

export const blankPort = (id: string, name: string): WorkflowPort => ({
  id,
  name,
  schema: true,
})

export const upsertNode = (
  drawing: WorkflowDrawing,
  node: WorkflowNode,
): WorkflowDrawing => ({
  ...drawing,
  nodes: drawing.nodes.some((existing) => existing.id === node.id)
    ? drawing.nodes.map((existing) => (existing.id === node.id ? node : existing))
    : [...drawing.nodes, node],
})

export const removeNode = (drawing: WorkflowDrawing, nodeId: string): WorkflowDrawing => {
  const node = drawing.nodes.find((candidate) => candidate.id === nodeId)
  if (!node || isWorkItemInputNode(node)) {
    return drawing
  }
  const removedPorts = new Set([
    ...node.inputs.map((port) => port.id),
    ...node.outputs.map((port) => port.id),
  ])
  return {
    ...drawing,
    nodes: drawing.nodes.filter((candidate) => candidate.id !== nodeId),
    connections: drawing.connections.filter(
      (connection) =>
        !removedPorts.has(connection.inputPortId) &&
        !removedPorts.has(connection.outputPortId),
    ),
  }
}

export const removePort = (
  drawing: WorkflowDrawing,
  nodeId: string,
  portId: string,
): WorkflowDrawing => {
  const node = drawing.nodes.find((candidate) => candidate.id === nodeId)
  if (!node || isWorkItemInputNode(node)) {
    return drawing
  }
  const nextNode: WorkflowNode = {
    ...node,
    inputs: node.inputs.filter((port) => port.id !== portId),
    outputs: node.outputs.filter((port) => port.id !== portId),
  }
  if (nextNode.inputs.length === node.inputs.length && nextNode.outputs.length === node.outputs.length) {
    return drawing
  }
  return {
    ...upsertNode(drawing, nextNode),
    connections: drawing.connections.filter(
      (connection) => connection.inputPortId !== portId && connection.outputPortId !== portId,
    ),
  }
}

export const moveNode = (
  drawing: WorkflowDrawing,
  nodeId: string,
  x: number,
  y: number,
): WorkflowDrawing => {
  const node = drawing.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) {
    return drawing
  }
  return upsertNode(drawing, {
    ...node,
    position: { x, y },
  })
}

export const addConnection = (
  drawing: WorkflowDrawing,
  outputPortId: string,
  inputPortId: string,
): WorkflowDrawing => {
  if (
    drawing.connections.some(
      (connection) =>
        connection.outputPortId === outputPortId && connection.inputPortId === inputPortId,
    )
  ) {
    return drawing
  }

  const outputOwner = findPortOwner(drawing, outputPortId)
  const inputOwner = findPortOwner(drawing, inputPortId)
  if (
    !outputOwner ||
    !inputOwner ||
    outputOwner.kind !== 'output' ||
    inputOwner.kind !== 'input' ||
    outputOwner.node.id === inputOwner.node.id
  ) {
    return drawing
  }

  const connection: WorkflowConnection = {
    id: crypto.randomUUID(),
    outputPortId,
    inputPortId,
  }
  return {
    ...drawing,
    connections: [
      ...drawing.connections.filter((existing) => existing.inputPortId !== inputPortId),
      connection,
    ],
  }
}

export const removeConnection = (
  drawing: WorkflowDrawing,
  connectionId: string,
): WorkflowDrawing => ({
  ...drawing,
  connections: drawing.connections.filter((connection) => connection.id !== connectionId),
})

export const findPortOwner = (
  drawing: WorkflowDrawing,
  portId: string,
): { readonly node: WorkflowNode; readonly kind: 'input' | 'output' } | null => {
  for (const node of drawing.nodes) {
    if (node.inputs.some((port) => port.id === portId)) {
      return { node, kind: 'input' }
    }
    if (node.outputs.some((port) => port.id === portId)) {
      return { node, kind: 'output' }
    }
  }
  return null
}

export const parseDefinitionSpecText = (text: string): unknown => {
  const trimmed = text.trim()
  if (trimmed === '') {
    return null
  }
  return JSON.parse(trimmed) as unknown
}

export const definitionSpecText = (definition: NodeDefinition | null): string => {
  if (!definition || definition.spec === null || definition.spec === undefined) {
    return ''
  }
  return JSON.stringify(definition.spec, null, 2)
}
