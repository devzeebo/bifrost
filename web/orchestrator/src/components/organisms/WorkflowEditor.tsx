import { useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import {
  addConnection,
  createBlankNode,
  moveNode,
  removeConnection,
  removeNode,
  upsertNode,
} from '../../workflows/drawing'
import type { WorkflowDrawing, WorkflowNode } from '../../workflows/types'
import { WorkflowCanvas } from './WorkflowCanvas'
import { WorkflowNodePanel } from './WorkflowNodePanel'
import { WorkflowSaveConflictDialog } from './WorkflowSaveConflictDialog'

type WorkflowEditorProps = {
  readonly drawing: WorkflowDrawing
  readonly dirty: boolean
  readonly saving: boolean
  readonly refusalMessage: string | null
  readonly highlight: {
    readonly connectionIds: readonly string[]
    readonly nodeIds: readonly string[]
    readonly message: string
  } | null
  readonly conflictOpen: boolean
  readonly saveError: string | null
  readonly exists: boolean
  readonly onChangeDrawing: (updater: (current: WorkflowDrawing) => WorkflowDrawing) => void
  readonly onChangeName: (name: string) => void
  readonly onSave: () => Promise<boolean>
  readonly onOverwrite: () => Promise<boolean>
  readonly onDiscardRemote: () => Promise<void>
  readonly onDismissConflict: () => void
}

export const WorkflowEditor = ({
  drawing,
  dirty,
  saving,
  refusalMessage,
  highlight,
  conflictOpen,
  saveError,
  exists,
  onChangeDrawing,
  onChangeName,
  onSave,
  onOverwrite,
  onDiscardRemote,
  onDismissConflict,
}: WorkflowEditorProps) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode =
    drawing.nodes.find((node) => node.id === selectedNodeId) ?? null

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) {
        return false
      }
      return !window.confirm('You have an unsaved drawing. Leave anyway?')
    },
    enableBeforeUnload: dirty,
  })

  const updateSelected = (node: WorkflowNode) => {
    onChangeDrawing((current) => upsertNode(current, node))
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-muted uppercase">
              Workflow name
              {dirty ? <span className="ml-1 font-bold text-signal">*</span> : null}
            </span>
            <input
              value={drawing.name}
              onChange={(event) => onChangeName(event.target.value)}
              className="h-10 border border-line bg-ink px-3 text-fg outline-none focus:border-signal-dim"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const node = createBlankNode({
                  x: 80 + drawing.nodes.length * 24,
                  y: 80 + drawing.nodes.length * 16,
                })
                onChangeDrawing((current) => upsertNode(current, node))
                setSelectedNodeId(node.id)
              }}
              className="h-10 border border-line px-4 text-xs tracking-[0.16em] text-fg uppercase"
            >
              Add node
            </button>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void onSave()}
              className="h-10 border border-signal-dim px-4 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
            >
              {saving ? 'Saving…' : exists ? 'Save' : 'Create'}
            </button>
          </div>
        </div>

        {saveError && !conflictOpen ? <p className="text-sm text-signal">{saveError}</p> : null}
        {refusalMessage ? <p className="text-sm text-signal">{refusalMessage}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem]">
        <WorkflowCanvas
          drawing={drawing}
          selectedNodeId={selectedNodeId}
          highlight={highlight}
          onSelectNode={setSelectedNodeId}
          onMoveNode={(nodeId, x, y) =>
            onChangeDrawing((current) => moveNode(current, nodeId, x, y))
          }
          onConnect={(outputPortId, inputPortId) =>
            onChangeDrawing((current) => addConnection(current, outputPortId, inputPortId))
          }
          onRemoveConnection={(connectionId) =>
            onChangeDrawing((current) => removeConnection(current, connectionId))
          }
        />
        <WorkflowNodePanel
          node={selectedNode}
          onChange={updateSelected}
          onDelete={(nodeId) => {
            onChangeDrawing((current) => removeNode(current, nodeId))
            setSelectedNodeId(null)
          }}
        />
      </div>

      {conflictOpen ? (
        <WorkflowSaveConflictDialog
          message={saveError ?? 'Workflow changed since it was opened.'}
          onOverwrite={() => void onOverwrite()}
          onDiscard={() => void onDiscardRemote()}
          onCancel={onDismissConflict}
        />
      ) : null}
    </div>
  )
}
