import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { SaveRefusalHighlight, WorkflowDrawing, WorkflowNode } from '../../workflows/types'

const NODE_WIDTH = 200
const PORT_SIZE = 12
const HEADER_HEIGHT = 36
const PORT_ROW = 28

type WorkflowCanvasProps = {
  readonly drawing: WorkflowDrawing
  readonly selectedNodeId: string | null
  readonly highlight: SaveRefusalHighlight | null
  readonly onSelectNode: (nodeId: string | null) => void
  readonly onMoveNode: (nodeId: string, x: number, y: number) => void
  readonly onConnect: (outputPortId: string, inputPortId: string) => void
  readonly onRemoveConnection: (connectionId: string) => void
}

type DragNode = {
  readonly nodeId: string
  readonly originX: number
  readonly originY: number
  readonly pointerStartX: number
  readonly pointerStartY: number
}

type LinkDraft = {
  readonly fromPortId: string
  readonly fromKind: 'input' | 'output'
  readonly x: number
  readonly y: number
}

export const WorkflowCanvas = ({
  drawing,
  selectedNodeId,
  highlight,
  onSelectNode,
  onMoveNode,
  onConnect,
  onRemoveConnection,
}: WorkflowCanvasProps) => {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const linkDraftRef = useRef<LinkDraft | null>(null)
  const [drag, setDrag] = useState<DragNode | null>(null)
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null)

  useEffect(() => {
    linkDraftRef.current = linkDraft
  }, [linkDraft])

  const portCenters = useMemo(() => buildPortCenters(drawing.nodes), [drawing.nodes])

  const highlightedConnections = new Set(highlight?.connectionIds ?? [])
  const highlightedNodes = new Set(highlight?.nodeIds ?? [])

  const toLocal = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) {
      return { x: clientX, y: clientY }
    }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const clearLinkDraft = () => {
    linkDraftRef.current = null
    setLinkDraft(null)
  }

  const finishLinkAt = (clientX: number, clientY: number) => {
    const draft = linkDraftRef.current
    if (!draft) {
      return
    }

    const target = portUnderPoint(clientX, clientY)
    clearLinkDraft()

    if (!target || target.portId === draft.fromPortId) {
      return
    }

    if (draft.fromKind === 'output' && target.kind === 'input') {
      onConnect(draft.fromPortId, target.portId)
      return
    }
    if (draft.fromKind === 'input' && target.kind === 'output') {
      onConnect(target.portId, draft.fromPortId)
    }
  }

  const onNodePointerDown = (event: ReactPointerEvent, node: WorkflowNode) => {
    if (isPortTarget(event.target)) {
      return
    }
    event.preventDefault()
    onSelectNode(node.id)
    surfaceRef.current?.setPointerCapture(event.pointerId)
    setDrag({
      nodeId: node.id,
      originX: node.position.x,
      originY: node.position.y,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
    })
  }

  const onSurfacePointerMove = (event: ReactPointerEvent) => {
    if (drag) {
      const dx = event.clientX - drag.pointerStartX
      const dy = event.clientY - drag.pointerStartY
      onMoveNode(drag.nodeId, drag.originX + dx, drag.originY + dy)
      return
    }
    const draft = linkDraftRef.current
    if (draft) {
      const point = toLocal(event.clientX, event.clientY)
      const next = { ...draft, x: point.x, y: point.y }
      linkDraftRef.current = next
      setLinkDraft(next)
    }
  }

  const onSurfacePointerUp = (event: ReactPointerEvent) => {
    if (linkDraftRef.current) {
      finishLinkAt(event.clientX, event.clientY)
    }
    setDrag(null)
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId)
    }
  }

  const onPortPointerDown = (
    event: ReactPointerEvent,
    portId: string,
    kind: 'input' | 'output',
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const point = toLocal(event.clientX, event.clientY)
    const draft = { fromPortId: portId, fromKind: kind, x: point.x, y: point.y }
    linkDraftRef.current = draft
    setLinkDraft(draft)
    surfaceRef.current?.setPointerCapture(event.pointerId)
  }

  const onSurfacePointerDown = (event: ReactPointerEvent) => {
    if (event.target !== surfaceRef.current) {
      return
    }
    onSelectNode(null)
  }

  return (
    <div
      ref={surfaceRef}
      className="relative h-full min-h-0 overflow-hidden border border-line bg-ink"
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onSurfacePointerMove}
      onPointerUp={onSurfacePointerUp}
      onPointerCancel={onSurfacePointerUp}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {drawing.connections.map((connection) => {
          const from = portCenters.get(connection.outputPortId)
          const to = portCenters.get(connection.inputPortId)
          if (!from || !to) {
            return null
          }
          const hot = highlightedConnections.has(connection.id)
          return (
            <g key={connection.id} className="pointer-events-auto">
              <path
                d={bezier(from.x, from.y, to.x, to.y)}
                fill="none"
                stroke={hot ? 'var(--color-signal)' : 'var(--color-signal-dim)'}
                strokeWidth={hot ? 3 : 2}
              />
              <path
                d={bezier(from.x, from.y, to.x, to.y)}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemoveConnection(connection.id)
                }}
              />
            </g>
          )
        })}
        {linkDraft
          ? (() => {
              const from = portCenters.get(linkDraft.fromPortId)
              if (!from) {
                return null
              }
              const start =
                linkDraft.fromKind === 'output' ? from : { x: linkDraft.x, y: linkDraft.y }
              const end =
                linkDraft.fromKind === 'output' ? { x: linkDraft.x, y: linkDraft.y } : from
              return (
                <path
                  d={bezier(start.x, start.y, end.x, end.y)}
                  fill="none"
                  stroke="var(--color-signal)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )
            })()
          : null}
      </svg>

      {drawing.nodes.map((node) => {
        const selected = selectedNodeId === node.id
        const hot = highlightedNodes.has(node.id)
        const height = nodeHeight(node)
        return (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            data-workflow-node={node.id}
            onPointerDown={(event) => onNodePointerDown(event, node)}
            className={`absolute flex cursor-grab flex-col border bg-surface select-none ${
              hot
                ? 'border-signal'
                : selected
                  ? 'border-signal-dim'
                  : 'border-line'
            }`}
            style={{
              left: node.position.x,
              top: node.position.y,
              width: NODE_WIDTH,
              minHeight: height,
            }}
          >
            <div className="border-b border-line px-3 py-2 text-sm text-fg">{node.name}</div>
            <div className="flex justify-between gap-2 px-2 py-2">
              <div className="flex flex-col gap-2">
                {node.inputs.map((port) => (
                  <PortHandle
                    key={port.id}
                    portId={port.id}
                    kind="input"
                    label={port.name}
                    side="left"
                    onPointerDown={(event) => onPortPointerDown(event, port.id, 'input')}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {node.outputs.map((port) => (
                  <PortHandle
                    key={port.id}
                    portId={port.id}
                    kind="output"
                    label={port.name}
                    side="right"
                    onPointerDown={(event) => onPortPointerDown(event, port.id, 'output')}
                  />
                ))}
              </div>
            </div>
            <p className="px-3 pb-2 text-[10px] tracking-[0.16em] text-muted uppercase">
              {node.definition?.style ?? 'undefined'}
            </p>
          </div>
        )
      })}

      {highlight ? (
        <div className="pointer-events-none absolute right-3 bottom-3 left-3 border border-signal bg-surface/95 px-3 py-2 text-sm text-signal">
          {highlight.message}
        </div>
      ) : null}
    </div>
  )
}

type PortHandleProps = {
  readonly portId: string
  readonly kind: 'input' | 'output'
  readonly label: string
  readonly side: 'left' | 'right'
  readonly onPointerDown: (event: ReactPointerEvent) => void
}

const PortHandle = ({ portId, kind, label, side, onPointerDown }: PortHandleProps) => (
  <div
    className={`flex items-center gap-2 ${side === 'right' ? 'flex-row-reverse' : 'flex-row'}`}
  >
    <button
      type="button"
      data-workflow-port={portId}
      data-workflow-port-kind={kind}
      aria-label={label}
      onPointerDown={onPointerDown}
      className="-m-2 flex items-center justify-center rounded-full p-2"
    >
      <span
        className="block rounded-full border border-signal-dim bg-ink"
        style={{ width: PORT_SIZE, height: PORT_SIZE }}
      />
    </button>
    <span className="max-w-[4.5rem] truncate text-[11px] text-muted">{label}</span>
  </div>
)

const isPortTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false
  }
  return target.closest('[data-workflow-port]') !== null
}

const portUnderPoint = (
  clientX: number,
  clientY: number,
): { readonly portId: string; readonly kind: 'input' | 'output' } | null => {
  const element = document.elementFromPoint(clientX, clientY)
  if (!(element instanceof Element)) {
    return null
  }
  const port = element.closest('[data-workflow-port]')
  if (!(port instanceof HTMLElement)) {
    return null
  }
  const portId = port.dataset.workflowPort
  const kind = port.dataset.workflowPortKind
  if (!portId || (kind !== 'input' && kind !== 'output')) {
    return null
  }
  return { portId, kind }
}

const nodeHeight = (node: WorkflowNode): number => {
  const rows = Math.max(node.inputs.length, node.outputs.length, 1)
  return HEADER_HEIGHT + rows * PORT_ROW + 28
}

const buildPortCenters = (nodes: readonly WorkflowNode[]) => {
  const centers = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    node.inputs.forEach((port, index) => {
      centers.set(port.id, {
        x: node.position.x,
        y: node.position.y + HEADER_HEIGHT + index * PORT_ROW + PORT_ROW / 2,
      })
    })
    node.outputs.forEach((port, index) => {
      centers.set(port.id, {
        x: node.position.x + NODE_WIDTH,
        y: node.position.y + HEADER_HEIGHT + index * PORT_ROW + PORT_ROW / 2,
      })
    })
  }
  return centers
}

const bezier = (x1: number, y1: number, x2: number, y2: number): string => {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.45)
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
}
