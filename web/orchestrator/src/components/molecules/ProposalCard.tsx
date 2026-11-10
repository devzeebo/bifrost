import { useState } from 'react'
import type { Proposal, ProposalEffect } from '../../capabilities/types'

type ProposalCardProps = {
  readonly proposal: Proposal
  readonly busy: boolean
  readonly onApply: (proposalId: string) => Promise<void>
  readonly onDismiss: (proposalId: string) => Promise<void>
  readonly onReread: (proposalId: string) => Promise<void>
}

export const ProposalCard = ({
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
    case 'DuplicateEval':
      return effect.sourceEvalId
        ? `Eval — ${label} (from ${effect.sourceEvalId})`
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
