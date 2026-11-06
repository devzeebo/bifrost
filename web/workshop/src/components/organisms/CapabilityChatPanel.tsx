import { useState, type FormEvent } from 'react'
import type { ChatMessage, Proposal, ProposalEffect } from '../../capabilities/types'

type CapabilityChatPanelProps = {
  readonly messages: readonly ChatMessage[]
  readonly pendingProposals: readonly Proposal[]
  readonly busy: boolean
  readonly onSend: (message: string) => Promise<void>
  readonly onApply: (proposalId: string) => Promise<void>
  readonly onDismiss: (proposalId: string) => Promise<void>
  readonly onReread: (proposalId: string) => Promise<void>
}

export const CapabilityChatPanel = ({
  messages,
  pendingProposals,
  busy,
  onSend,
  onApply,
  onDismiss,
  onReread,
}: CapabilityChatPanelProps) => {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message) {
      return
    }
    setError(null)
    try {
      await onSend(message)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message')
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Workshop chat</h2>
      <div className="flex flex-col gap-4 border border-line bg-surface px-5 py-6">
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted">
              Ask to sharpen, split, or retire criteria, reword the ask, add evals, or rewrite the
              skill. Changes arrive as proposals you apply or dismiss.
            </p>
          ) : (
            messages.map((message) => <ChatBubble key={message.id} message={message} />)
          )}
        </div>

        {pendingProposals.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-xs tracking-[0.16em] text-muted uppercase">Pending proposals</h3>
            {pendingProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                busy={busy}
                onApply={onApply}
                onDismiss={onDismiss}
                onReread={onReread}
              />
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-muted uppercase">Message</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim"
              disabled={busy}
            />
          </label>
          {error ? <p className="text-sm text-signal">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || draft.trim() === ''}
            className="self-start border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  )
}

const ChatBubble = ({ message }: { readonly message: ChatMessage }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs tracking-[0.16em] text-muted uppercase">{message.role}</span>
    <p className="whitespace-pre-wrap text-sm text-fg">{message.text}</p>
  </div>
)

type ProposalCardProps = {
  readonly proposal: Proposal
  readonly busy: boolean
  readonly onApply: (proposalId: string) => Promise<void>
  readonly onDismiss: (proposalId: string) => Promise<void>
  readonly onReread: (proposalId: string) => Promise<void>
}

const ProposalCard = ({
  proposal,
  busy,
  onApply,
  onDismiss,
  onReread,
}: ProposalCardProps) => {
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update proposal')
    }
  }

  return (
    <article className="flex flex-col gap-3 border border-line bg-ink px-4 py-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm text-fg">{proposal.summary}</h4>
        {proposal.isStale ? (
          <p className="text-sm text-signal">
            {proposal.staleNote ?? 'Stale — re-read before applying.'}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {proposal.effects.map((effect, index) => (
          <li key={`${proposal.id}-${index}`} className="text-sm text-muted">
            {describeEffect(effect)}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {proposal.isStale ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onReread(proposal.id))}
            className="border border-signal-dim px-3 py-1.5 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
          >
            Re-read
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onApply(proposal.id))}
            className="border border-signal-dim px-3 py-1.5 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
          >
            Apply
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => onDismiss(proposal.id))}
          className="border border-line px-3 py-1.5 text-xs tracking-[0.16em] text-muted uppercase disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </article>
  )
}

const describeEffect = (effect: ProposalEffect): string => {
  const label = effect.description?.trim() || effect.kind
  switch (effect.kind) {
    case 'AmendAsk':
      return effect.ask?.trim()
        ? `Ask — ${label}: ${effect.ask.trim()}`
        : `Ask — ${label}`
    case 'AddCriterion':
    case 'SharpenCriterion':
      return effect.statement?.trim()
        ? `Criterion — ${label}: ${effect.statement.trim()}`
        : `Criterion — ${label}`
    case 'SplitCriterion': {
      const parts = (effect.newCriteria ?? [])
        .map((criterion) => criterion.statement.trim())
        .filter((statement) => statement.length > 0)
      return parts.length > 0
        ? `Criterion — ${label}: ${parts.join(' / ')}`
        : `Criterion — ${label}`
    }
    case 'RetireCriterion':
      return effect.criterionId
        ? `Criterion — ${label} (${effect.criterionId})`
        : `Criterion — ${label}`
    case 'AddEval':
    case 'AmendEval':
      return effect.scenario?.trim()
        ? `Eval — ${label}: ${effect.scenario.trim()}`
        : `Eval — ${label}`
    case 'RetireEval':
      return effect.evalId ? `Eval — ${label} (${effect.evalId})` : `Eval — ${label}`
    case 'ReplaceSkill':
      return effect.markdown?.trim()
        ? `Skill — ${label}: ${summarizeMarkdown(effect.markdown)}`
        : `Skill — ${label}`
    default:
      return label
  }
}

const summarizeMarkdown = (markdown: string): string => {
  const compact = markdown.trim().replace(/\s+/g, ' ')
  return compact.length <= 120 ? compact : `${compact.slice(0, 117)}…`
}
