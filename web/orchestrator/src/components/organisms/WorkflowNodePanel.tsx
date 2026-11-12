import { useEffect, useState } from 'react'
import {
  blankPort,
  definitionSpecText,
  isWorkItemInputNode,
  parseDefinitionSpecText,
  WORK_ITEM_OUTPUT_SCHEMA,
} from '../../workflows/drawing'
import type { WorkflowNode, WorkflowPort } from '../../workflows/types'

type WorkflowNodePanelProps = {
  readonly node: WorkflowNode | null
  readonly disabled?: boolean
  readonly onDraftDirty: (dirty: boolean) => void
  readonly onChange: (node: WorkflowNode) => void
  readonly onRemovePort: (portId: string) => void
  readonly onDelete: (nodeId: string) => void
}

export const WorkflowNodePanel = ({
  node,
  disabled = false,
  onDraftDirty,
  onChange,
  onRemovePort,
  onDelete,
}: WorkflowNodePanelProps) => {
  const [specText, setSpecText] = useState('')
  const [specError, setSpecError] = useState<string | null>(null)
  const [inputSchemaText, setInputSchemaText] = useState('true')
  const [inputSchemaError, setInputSchemaError] = useState<string | null>(null)
  const [schemaDrafts, setSchemaDrafts] = useState<Readonly<Record<string, string>>>({})

  const workItemInput = node !== null && isWorkItemInputNode(node)

  useEffect(() => {
    setSpecText(definitionSpecText(node?.definition ?? null))
    setSpecError(null)
    setInputSchemaText(schemaText(readInputSchema(node)))
    setInputSchemaError(null)
    setSchemaDrafts({})
  }, [node?.id, node?.definition])

  useEffect(() => {
    if (!node) {
      onDraftDirty(false)
      return
    }
    if (workItemInput) {
      onDraftDirty(inputSchemaText !== schemaText(readInputSchema(node)))
      return
    }
    const specDirty = specText !== definitionSpecText(node.definition ?? null)
    const schemaDirty = Object.entries(schemaDrafts).some(([portId, text]) => {
      const port = [...node.inputs, ...node.outputs].find((candidate) => candidate.id === portId)
      return port !== undefined && text !== schemaText(port.schema)
    })
    onDraftDirty(specDirty || schemaDirty)
  }, [node, onDraftDirty, schemaDrafts, specText, inputSchemaText, workItemInput])

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

  const applyInputSchema = () => {
    try {
      const inputSchema = JSON.parse(inputSchemaText) as unknown
      setInputSchemaError(null)
      onChange({
        ...node,
        definition: {
          style: 'work-item-input',
          spec: { inputSchema },
        },
        outputs: node.outputs.map((port, index) =>
          index === 0 ? { ...port, schema: { ...WORK_ITEM_OUTPUT_SCHEMA } } : port,
        ),
      })
    } catch {
      setInputSchemaError('Input schema must be valid JSON.')
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-l border-line bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tracking-[0.16em] text-muted uppercase">
          {workItemInput ? 'Work item input' : 'Node'}
        </p>
        {workItemInput ? null : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(node.id)}
            className="text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Name</span>
        <input
          value={node.name}
          disabled={disabled}
          onChange={(event) => onChange({ ...node, name: event.target.value })}
          className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim disabled:opacity-50"
        />
      </label>

      {workItemInput ? (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-muted uppercase">Input schema</span>
            <textarea
              value={inputSchemaText}
              disabled={disabled}
              onChange={(event) => setInputSchemaText(event.target.value)}
              onBlur={applyInputSchema}
              rows={8}
              className="border border-line bg-ink px-3 py-2 font-mono text-xs text-fg outline-none focus:border-signal-dim disabled:opacity-50"
            />
            {inputSchemaError ? <p className="text-sm text-signal">{inputSchemaError}</p> : null}
          </label>
          <div className="flex flex-col gap-2">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">Output schema</p>
            <pre className="border border-line bg-ink px-3 py-2 font-mono text-xs text-muted">
              {schemaText(WORK_ITEM_OUTPUT_SCHEMA)}
            </pre>
          </div>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-muted uppercase">Definition style</span>
            <select
              value={node.definition?.style ?? 'script'}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...node,
                  definition: {
                    style: event.target.value,
                    spec: node.definition?.spec ?? null,
                  },
                })
              }
              className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim disabled:opacity-50"
            >
              <option value="script">script</option>
              <option value="harness">harness</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-muted uppercase">
              Definition spec (JSON)
            </span>
            <textarea
              value={specText}
              disabled={disabled}
              onChange={(event) => setSpecText(event.target.value)}
              onBlur={applySpec}
              rows={8}
              className="border border-line bg-ink px-3 py-2 font-mono text-xs text-fg outline-none focus:border-signal-dim disabled:opacity-50"
            />
            {specError ? <p className="text-sm text-signal">{specError}</p> : null}
          </label>

          <PortList
            title="Inputs"
            ports={node.inputs}
            disabled={disabled}
            schemaDrafts={schemaDrafts}
            onAdd={() => addPort('inputs')}
            onChange={(portId, patch) => updatePort('inputs', portId, patch)}
            onSchemaDraftChange={(portId, text) =>
              setSchemaDrafts((current) => ({ ...current, [portId]: text }))
            }
            onRemove={onRemovePort}
          />
          <PortList
            title="Outputs"
            ports={node.outputs}
            disabled={disabled}
            schemaDrafts={schemaDrafts}
            onAdd={() => addPort('outputs')}
            onChange={(portId, patch) => updatePort('outputs', portId, patch)}
            onSchemaDraftChange={(portId, text) =>
              setSchemaDrafts((current) => ({ ...current, [portId]: text }))
            }
            onRemove={onRemovePort}
          />
        </>
      )}
    </aside>
  )
}

type PortListProps = {
  readonly title: string
  readonly ports: readonly WorkflowPort[]
  readonly disabled: boolean
  readonly schemaDrafts: Readonly<Record<string, string>>
  readonly onAdd: () => void
  readonly onChange: (portId: string, patch: Partial<WorkflowPort>) => void
  readonly onSchemaDraftChange: (portId: string, text: string) => void
  readonly onRemove: (portId: string) => void
}

const PortList = ({
  title,
  ports,
  disabled,
  schemaDrafts,
  onAdd,
  onChange,
  onSchemaDraftChange,
  onRemove,
}: PortListProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">{title}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
      >
        Add
      </button>
    </div>
    {ports.length === 0 ? <p className="text-sm text-muted">None</p> : null}
    {ports.map((port) => {
      const draft = schemaDrafts[port.id]
      const value = draft ?? schemaText(port.schema)
      return (
        <div key={port.id} className="flex flex-col gap-2 border border-line px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <input
              value={port.name}
              disabled={disabled}
              onChange={(event) => onChange(port.id, { name: event.target.value })}
              className="w-full border border-line bg-ink px-2 py-1 text-sm text-fg outline-none focus:border-signal-dim disabled:opacity-50"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRemove(port.id)}
              className="shrink-0 text-xs text-muted uppercase disabled:opacity-50"
            >
              Remove
            </button>
          </div>
          <textarea
            value={value}
            disabled={disabled}
            onChange={(event) => {
              const text = event.target.value
              onSchemaDraftChange(port.id, text)
              try {
                onChange(port.id, { schema: JSON.parse(text) as unknown })
              } catch {
                // Keep the draft until JSON parses.
              }
            }}
            rows={3}
            className="border border-line bg-ink px-2 py-1 font-mono text-xs text-fg outline-none focus:border-signal-dim disabled:opacity-50"
          />
        </div>
      )
    })}
  </div>
)

const readInputSchema = (node: WorkflowNode | null): unknown => {
  if (!node || !isWorkItemInputNode(node)) {
    return true
  }
  const spec = node.definition?.spec
  if (spec && typeof spec === 'object' && !Array.isArray(spec) && 'inputSchema' in spec) {
    return (spec as { inputSchema: unknown }).inputSchema
  }
  return true
}

const schemaText = (schema: unknown): string => {
  try {
    return JSON.stringify(schema, null, 2)
  } catch {
    return 'true'
  }
}
