import { useEffect, useState } from 'react'
import {
  blankPort,
  definitionSpecText,
  parseDefinitionSpecText,
} from '../../workflows/drawing'
import type { WorkflowNode, WorkflowPort } from '../../workflows/types'

type WorkflowNodePanelProps = {
  readonly node: WorkflowNode | null
  readonly onChange: (node: WorkflowNode) => void
  readonly onDelete: (nodeId: string) => void
}

export const WorkflowNodePanel = ({ node, onChange, onDelete }: WorkflowNodePanelProps) => {
  const [specText, setSpecText] = useState('')
  const [specError, setSpecError] = useState<string | null>(null)

  useEffect(() => {
    setSpecText(definitionSpecText(node?.definition ?? null))
    setSpecError(null)
  }, [node?.id, node?.definition])

  if (!node) {
    return (
      <aside className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-line bg-surface px-4 py-4">
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Node</p>
        <p className="text-sm text-muted">Select a node to edit its definition and ports.</p>
      </aside>
    )
  }

  const updatePort = (
    kind: 'inputs' | 'outputs',
    portId: string,
    patch: Partial<WorkflowPort>,
  ) => {
    onChange({
      ...node,
      [kind]: node[kind].map((port) => (port.id === portId ? { ...port, ...patch } : port)),
    })
  }

  const addPort = (kind: 'inputs' | 'outputs') => {
    const label = kind === 'inputs' ? 'in' : 'out'
    onChange({
      ...node,
      [kind]: [...node[kind], blankPort(crypto.randomUUID(), label)],
    })
  }

  const removePort = (kind: 'inputs' | 'outputs', portId: string) => {
    onChange({
      ...node,
      [kind]: node[kind].filter((port) => port.id !== portId),
    })
  }

  const applySpec = () => {
    try {
      const spec = parseDefinitionSpecText(specText)
      setSpecError(null)
      onChange({
        ...node,
        definition: {
          style: node.definition?.style ?? 'script',
          spec,
        },
      })
    } catch {
      setSpecError('Spec must be valid JSON.')
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-l border-line bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Node</p>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
          className="text-xs tracking-[0.16em] text-signal uppercase"
        >
          Delete
        </button>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Name</span>
        <input
          value={node.name}
          onChange={(event) => onChange({ ...node, name: event.target.value })}
          className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Definition style</span>
        <select
          value={node.definition?.style ?? 'script'}
          onChange={(event) =>
            onChange({
              ...node,
              definition: {
                style: event.target.value,
                spec: node.definition?.spec ?? null,
              },
            })
          }
          className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim"
        >
          <option value="script">script</option>
          <option value="harness">harness</option>
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Definition spec (JSON)</span>
        <textarea
          value={specText}
          onChange={(event) => setSpecText(event.target.value)}
          onBlur={applySpec}
          rows={8}
          className="border border-line bg-ink px-3 py-2 font-mono text-xs text-fg outline-none focus:border-signal-dim"
        />
        {specError ? <p className="text-sm text-signal">{specError}</p> : null}
      </label>

      <PortList
        title="Inputs"
        ports={node.inputs}
        onAdd={() => addPort('inputs')}
        onChange={(portId, patch) => updatePort('inputs', portId, patch)}
        onRemove={(portId) => removePort('inputs', portId)}
      />
      <PortList
        title="Outputs"
        ports={node.outputs}
        onAdd={() => addPort('outputs')}
        onChange={(portId, patch) => updatePort('outputs', portId, patch)}
        onRemove={(portId) => removePort('outputs', portId)}
      />
    </aside>
  )
}

type PortListProps = {
  readonly title: string
  readonly ports: readonly WorkflowPort[]
  readonly onAdd: () => void
  readonly onChange: (portId: string, patch: Partial<WorkflowPort>) => void
  readonly onRemove: (portId: string) => void
}

const PortList = ({ title, ports, onAdd, onChange, onRemove }: PortListProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">{title}</p>
      <button
        type="button"
        onClick={onAdd}
        className="text-xs tracking-[0.16em] text-signal uppercase"
      >
        Add
      </button>
    </div>
    {ports.length === 0 ? <p className="text-sm text-muted">None</p> : null}
    {ports.map((port) => (
      <div key={port.id} className="flex flex-col gap-2 border border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <input
            value={port.name}
            onChange={(event) => onChange(port.id, { name: event.target.value })}
            className="w-full border border-line bg-ink px-2 py-1 text-sm text-fg outline-none focus:border-signal-dim"
          />
          <button
            type="button"
            onClick={() => onRemove(port.id)}
            className="shrink-0 text-xs text-muted uppercase"
          >
            Remove
          </button>
        </div>
        <textarea
          value={schemaText(port.schema)}
          onChange={(event) => {
            try {
              onChange(port.id, { schema: JSON.parse(event.target.value) as unknown })
            } catch {
              // Keep editing until JSON parses.
            }
          }}
          rows={3}
          className="border border-line bg-ink px-2 py-1 font-mono text-xs text-fg outline-none focus:border-signal-dim"
        />
      </div>
    ))}
  </div>
)

const schemaText = (schema: unknown): string => {
  try {
    return JSON.stringify(schema, null, 2)
  } catch {
    return 'true'
  }
}
