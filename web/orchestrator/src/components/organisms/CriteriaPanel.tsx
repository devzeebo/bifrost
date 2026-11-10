import { useEffect, useState, type FormEvent } from 'react'
import type {
  CriterionSnapshot,
  HandSaveResult,
  Proposal,
} from '../../capabilities/types'
import { ProposalCard } from '../molecules/ProposalCard'

type CriteriaPanelProps = {
  readonly criteria: readonly CriterionSnapshot[]
  readonly currentCapabilityVersionId: string | null
  readonly onSaveCriterion: (criterionId: string, statement: string) => Promise<HandSaveResult>
  readonly onApplyProposal: (proposalId: string) => Promise<void>
  readonly onDismissProposal: (proposalId: string) => Promise<void>
  readonly onRereadProposal: (proposalId: string) => Promise<void>
  readonly proposalBusy: boolean
}

export const CriteriaPanel = ({
  criteria,
  currentCapabilityVersionId,
  onSaveCriterion,
  onApplyProposal,
  onDismissProposal,
  onRereadProposal,
  proposalBusy,
}: CriteriaPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Criteria</h2>
    {criteria.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No criteria yet. Decompose the ask into independent, eval-backed criteria.
      </p>
    ) : (
      <ul className="flex flex-col gap-3 border border-line bg-surface px-5 py-6">
        {criteria.map((criterion) => (
          <li key={criterion.id}>
            <CriterionEditor
              criterion={criterion}
              currentCapabilityVersionId={currentCapabilityVersionId}
              onSaveCriterion={onSaveCriterion}
              onApplyProposal={onApplyProposal}
              onDismissProposal={onDismissProposal}
              onRereadProposal={onRereadProposal}
              proposalBusy={proposalBusy}
            />
          </li>
        ))}
      </ul>
    )}
  </section>
)

const CriterionEditor = ({
  criterion,
  currentCapabilityVersionId,
  onSaveCriterion,
  onApplyProposal,
  onDismissProposal,
  onRereadProposal,
  proposalBusy,
}: {
  readonly criterion: CriterionSnapshot
  readonly currentCapabilityVersionId: string | null
  readonly onSaveCriterion: (criterionId: string, statement: string) => Promise<HandSaveResult>
  readonly onApplyProposal: (proposalId: string) => Promise<void>
  readonly onDismissProposal: (proposalId: string) => Promise<void>
  readonly onRereadProposal: (proposalId: string) => Promise<void>
  readonly proposalBusy: boolean
}) => {
  const [draft, setDraft] = useState(criterion.statement)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null)
  const [loadedVersionId, setLoadedVersionId] = useState(currentCapabilityVersionId)
  const [layerMoved, setLayerMoved] = useState(false)

  useEffect(() => {
    if (pendingProposal || editing) {
      return
    }
    setDraft(criterion.statement)
    setLoadedVersionId(currentCapabilityVersionId)
    setLayerMoved(false)
  }, [criterion.statement, currentCapabilityVersionId, editing, pendingProposal])

  useEffect(() => {
    if (
      editing
      && loadedVersionId !== currentCapabilityVersionId
      && draft.trim() !== criterion.statement
    ) {
      setLayerMoved(true)
    }
  }, [
    criterion.statement,
    currentCapabilityVersionId,
    draft,
    editing,
    loadedVersionId,
  ])

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-fg">{criterion.statement}</p>
        <button
          type="button"
          className="border border-line px-3 py-1 text-xs tracking-[0.12em] text-muted uppercase"
          onClick={() => {
            setDraft(criterion.statement)
            setLoadedVersionId(currentCapabilityVersionId)
            setLayerMoved(false)
            setEditing(true)
          }}
        >
          Edit
        </button>
      </div>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (draft.trim().length === 0) {
      setError('Statement is required.')
      return
    }
    setSaving(true)
    try {
      const result = await onSaveCriterion(criterion.id, draft)
      if (result.outcome === 'Proposed' && result.proposal) {
        setPendingProposal(result.proposal)
      } else {
        setPendingProposal(null)
        setEditing(false)
        setLayerMoved(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save criterion')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {layerMoved ? (
        <p className="border border-signal-dim bg-ink px-3 py-2 text-sm text-signal">
          This criterion moved underneath your draft. Your words are kept; save to re-read, or
          cancel.
        </p>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Statement</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim"
        />
      </label>
      {pendingProposal ? (
        <ProposalCard
          proposal={pendingProposal}
          busy={proposalBusy || saving}
          onApply={async (proposalId) => {
            await onApplyProposal(proposalId)
            setPendingProposal(null)
            setEditing(false)
            setLayerMoved(false)
          }}
          onDismiss={async (proposalId) => {
            await onDismissProposal(proposalId)
            setPendingProposal(null)
          }}
          onReread={async (proposalId) => {
            await onRereadProposal(proposalId)
            setPendingProposal(null)
          }}
        />
      ) : null}
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || pendingProposal !== null}
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save criterion'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setEditing(false)
            setPendingProposal(null)
            setDraft(criterion.statement)
            setLayerMoved(false)
          }}
          className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-muted uppercase disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
