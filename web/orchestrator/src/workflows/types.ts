export type NodePosition = {
  readonly x: number
  readonly y: number
}

export type WorkflowPort = {
  readonly id: string
  readonly name: string
  readonly schema: unknown
}

export type NodeDefinition = {
  readonly style: string | null
  readonly spec: unknown
}

export type WorkflowNode = {
  readonly id: string
  readonly name: string
  readonly position: NodePosition
  readonly inputs: readonly WorkflowPort[]
  readonly outputs: readonly WorkflowPort[]
  readonly definition: NodeDefinition | null
}

export type WorkflowConnection = {
  readonly id: string
  readonly outputPortId: string
  readonly inputPortId: string
}

export type WorkflowDrawing = {
  readonly id: string
  readonly name: string
  readonly nodes: readonly WorkflowNode[]
  readonly connections: readonly WorkflowConnection[]
}

export type WorkflowDetail = WorkflowDrawing & {
  readonly version: number
}

export type WorkflowSummary = {
  readonly id: string
  readonly name: string
}

export type SaveRefusalHighlight = {
  readonly connectionIds: readonly string[]
  readonly nodeIds: readonly string[]
  readonly message: string
}
