import type { SaveRefusalHighlight, WorkflowDrawing } from './types'

const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export const highlightFromRefusal = (
  message: string,
  drawing: WorkflowDrawing,
): SaveRefusalHighlight => {
  const ids = [...message.matchAll(uuidPattern)].map((match) => match[0].toLowerCase())
  const connectionIds = drawing.connections
    .filter((connection) => {
      const connectionId = connection.id.toLowerCase()
      const outputId = connection.outputPortId.toLowerCase()
      const inputId = connection.inputPortId.toLowerCase()
      return (
        ids.includes(connectionId) ||
        (ids.includes(outputId) && ids.includes(inputId)) ||
        (message.toLowerCase().includes('connection') &&
          (ids.includes(outputId) || ids.includes(inputId)))
      )
    })
    .map((connection) => connection.id)

  const nodeIds = drawing.nodes
    .filter((node) => {
      const nodeId = node.id.toLowerCase()
      if (ids.includes(nodeId)) {
        return true
      }
      const nameNeedle = node.name.trim().toLowerCase()
      return nameNeedle !== '' && message.toLowerCase().includes(`'${nameNeedle}`)
    })
    .map((node) => node.id)

  return {
    connectionIds: unique(connectionIds),
    nodeIds: unique(nodeIds),
    message,
  }
}

const unique = (values: readonly string[]): readonly string[] => [...new Set(values)]
