import { useEffect, useState, type FormEvent } from 'react'
import type { HandSaveResult, Proposal } from '../../capabilities/types'
import { ProposalCard } from '../molecules/ProposalCard'

type AskDocumentProps = {
  readonly ask: string
  readonly name: string
  readonly hasUnsavedDraft: boolean
  readonly currentCapabilityVersionId: string | null
  readonly onSaveAsk: (ask: string) => Promise<HandSaveResult>
  readonly onSaveName: (name: string) => Promise<void>
  readonly onApplyProposal: (proposalId: string) => Promise<void>
  readonly onDismissProposal: (proposalId: string) => Promise<void>
  readonly onRereadProposal: (proposalId: string) => Promise<void>
  readonly proposalBusy: boolean
}

export const AskDocument = ({
  ask,
  name,
  hasUnsavedDraft,
  currentCapabilityVersionId,
  onSaveAsk,
  onSaveName,
  onApplyProposal,
  onDismissProposal,
  onRereadProposal,
  proposalBusy,
}: AskDocumentProps) => {
  const [draftAsk, setDraftAsk] = useState(ask)
  const [draftName, setDraftName] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingProposal, setPendingProposal] = useState<Proposal | null>(null)
  const [loadedVersionId, setLoadedVersionId] = useState(currentCapabilityVersionId)
  const [layerMoved, setLayerMoved] = useState(false)

  useEffect(() => {
    setDraftName(name)
  }, [name])

  useEffect(() => {
    if (pendingProposal) {
      return
    }
    setDraftAsk((current) => {
      // Keep an in-progress draft; never silently reload under the person typing.
      if (current.trim() !== ask) {
        return current
      }
      setLoadedVersionId(currentCapabilityVersionId)
      setLayerMoved(false)
      return ask
    })
  }, [ask, currentCapabilityVersionId, pendingProposal])

  useEffect(() => {
    if (loadedVersionId === currentCapabilityVersionId) {
      return
    }
    setDraftAsk((current) => {
      if (current.trim() !== ask) {
        setLayerMoved(true)
        return current
      }
      setLoadedVersionId(currentCapabilityVersionId)
      setLayerMoved(false)
      return current
    })
  }, [ask, currentCapabilityVersionId, loadedVersionId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (draftName.trim() !== name) {
        await onSaveName(draftName)
      }
      if (draftAsk.trim() !== ask || hasUnsavedDraft) {
        const result = await onSaveAsk(draftAsk)
        if (result.outcome === 'Proposed' && result.proposal) {
          setPendingProposal(result.proposal)
        } else {
          setPendingProposal(null)
          setLayerMoved(false)
          setLoadedVersionId(currentCapabilityVersionId)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const dirty =
    draftAsk.trim() !== ask || draftName.trim() !== name || hasUnsavedDraft

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Ask</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 border border-line bg-surface px-5 py-6">
        {layerMoved ? (
          <p className="border border-signal-dim bg-ink px-3 py-2 text-sm text-signal">
            This layer moved underneath your draft — the ask on screen is no longer the agreement.
            Your words are kept; save to re-read, or reload deliberately.
          </p>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="text-xs tracking-[0.16em] text-muted uppercase">Name</span>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs tracking-[0.16em] text-muted uppercase">Living document</span>
          <textarea
            value={draftAsk}
            onChange={(event) => setDraftAsk(event.target.value)}
            rows={10}
            className="border border-line bg-ink px-3 py-2 font-sans text-fg outline-none focus:border-signal-dim"
          />
        </label>
        {hasUnsavedDraft ? (
          <p className="text-sm text-muted">Draft restored from history — save to record a new version.</p>
        ) : null}
        {pendingProposal ? (
          <ProposalCard
            proposal={pendingProposal}
            busy={proposalBusy || saving}
            onApply={async (proposalId) => {
              await onApplyProposal(proposalId)
              setPendingProposal(null)
              setLayerMoved(false)
            }}
            onDismiss={async (proposalId) => {
              await onDismissProposal(proposalId)
              setPendingProposal(null)
            }}
            onReread={async (proposalId) => {
              await onRereadProposal(proposalId)
            }}
          />
        ) : null}
        {error ? <p className="text-sm text-signal">{error}</p> : null}
        <button
          type="submit"
          disabled={!dirty || saving || pendingProposal !== null}
          className="self-start border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save ask'}
        </button>
      </form>
    </section>
  )
}
