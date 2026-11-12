import { useEffect, useState, type FormEvent } from 'react'
import { listWorkflows } from '../../workflows/api'
import type { WorkflowSummary } from '../../workflows/types'
import { submitWorkflowWorkItem } from '../../workItems/submitWorkflowWorkItem'

type CreateWorkflowWorkItemFormProps = {
  readonly onCancel: () => void
  readonly onSubmitted: (workItemId: string) => void
}

export const CreateWorkflowWorkItemForm = ({
  onCancel,
  onSubmitted,
}: CreateWorkflowWorkItemFormProps) => {
  const [workflows, setWorkflows] = useState<readonly WorkflowSummary[] | null>(null)
  const [workflowId, setWorkflowId] = useState('')
  const [dataText, setDataText] = useState('{}')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingLibrary, setLoadingLibrary] = useState(true)

  useEffect(() => {
    let cancelled = false
    void listWorkflows()
      .then((items) => {
        if (cancelled) {
          return
        }
        setWorkflows(items)
        setWorkflowId((current) => current || items[0]?.id || '')
        setLoadingLibrary(false)
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load workflows')
        setWorkflows([])
        setLoadingLibrary(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (workflowId.trim() === '') {
      setError('Choose a workflow.')
      return
    }
    let data: unknown
    try {
      data = JSON.parse(dataText) as unknown
    } catch {
      setError('Data must be valid JSON.')
      return
    }
    setSaving(true)
    try {
      const result = await submitWorkflowWorkItem({ workflowId, data })
      onSubmitted(result.workItemId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit work item')
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      className="flex flex-col gap-6 border border-line bg-surface px-5 py-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-muted uppercase">Workflow work item</p>
        <p className="text-sm text-muted">
          Attach a new work item to a workflow and put it on the pending queue.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Workflow</span>
        <select
          value={workflowId}
          disabled={loadingLibrary || saving || (workflows?.length ?? 0) === 0}
          onChange={(event) => setWorkflowId(event.target.value)}
          className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim disabled:opacity-50"
          required
        >
          {loadingLibrary ? <option value="">Loading…</option> : null}
          {!loadingLibrary && (workflows?.length ?? 0) === 0 ? (
            <option value="">No workflows saved</option>
          ) : null}
          {workflows?.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name} ({workflow.id.slice(0, 8)})
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Data (JSON)</span>
        <textarea
          value={dataText}
          disabled={saving}
          onChange={(event) => setDataText(event.target.value)}
          rows={8}
          className="border border-line bg-ink px-3 py-2 font-mono text-xs text-fg outline-none focus:border-signal-dim disabled:opacity-50"
          spellCheck={false}
        />
      </label>

      {error ? <p className="text-sm text-signal">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || loadingLibrary || workflowId.trim() === ''}
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-muted uppercase disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
