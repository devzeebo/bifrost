import { useEffect, useState, type FormEvent } from 'react'
import { neverRunOutcome, outcomeEarnedUnderNote, outcomeLabel } from '../../capabilities/evalOutcome'
import type {
  CheckSnapshot,
  CriterionSnapshot,
  EvalLatestOutcome,
  EvalSnapshot,
} from '../../capabilities/types'

type SuitePanelProps = {
  readonly criteria: readonly CriterionSnapshot[]
  readonly evals: readonly EvalSnapshot[]
  readonly currentCapabilityVersionId: string | null
  readonly currentSkillVersionId: string | null
  readonly outcomes?: ReadonlyMap<string, EvalLatestOutcome>
  readonly onAmend: (input: {
    readonly evalId: string
    readonly scenario: string
    readonly prompt: string
    readonly context: string
    readonly checks: readonly CheckSnapshot[]
  }) => Promise<void>
  readonly onDuplicate: (evalId: string) => Promise<void>
  readonly onRetire: (evalId: string) => Promise<void>
}

export const SuitePanel = ({
  criteria,
  evals,
  currentCapabilityVersionId,
  currentSkillVersionId,
  outcomes,
  onAmend,
  onDuplicate,
  onRetire,
}: SuitePanelProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (criteria.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Suite</h2>
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
          No criteria yet. Decompose the ask into independent, eval-backed criteria.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Suite</h2>
      <div className="flex flex-col gap-4 border border-line bg-surface px-5 py-6">
        {criteria.map((criterion) => {
          const covering = evals.filter((item) => item.criterionId === criterion.id)
          return (
            <div key={criterion.id} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm text-fg">{criterion.statement}</h3>
                {covering.length === 0 ? (
                  <p className="text-sm text-signal">
                    Uncovered — no eval backs this criterion yet.
                  </p>
                ) : null}
              </div>
              {covering.length === 0 ? null : (
                <ul className="flex flex-col gap-2">
                  {covering.map((item) => {
                    const outcome = outcomes?.get(item.id) ?? neverRunOutcome()
                    const earnedNote = outcomeEarnedUnderNote({
                      outcome,
                      currentCapabilityVersionId,
                      currentSkillVersionId,
                    })
                    const expanded = expandedId === item.id
                    const editing = editingId === item.id
                    const isLast = covering.length === 1
                    return (
                      <li key={item.id} className="border border-line bg-ink px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <button
                            type="button"
                            className="flex flex-1 flex-col gap-1 text-left"
                            onClick={() =>
                              setExpandedId((current) => (current === item.id ? null : item.id))
                            }
                          >
                            <span className="text-sm text-fg">{item.scenario}</span>
                            <span className="text-xs tracking-[0.12em] text-muted uppercase">
                              {outcomeLabel(outcome.status)}
                              {earnedNote ? ` · ${earnedNote}` : ''}
                            </span>
                            {item.checks.length === 0 ? (
                              <span className="text-xs text-signal">No checks yet</span>
                            ) : null}
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="border border-line px-3 py-1 text-xs tracking-[0.12em] text-muted uppercase"
                              onClick={() => {
                                setExpandedId(item.id)
                                setEditingId(item.id)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="border border-line px-3 py-1 text-xs tracking-[0.12em] text-muted uppercase"
                              onClick={() => void onDuplicate(item.id)}
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="border border-line px-3 py-1 text-xs tracking-[0.12em] text-signal uppercase"
                              onClick={() => {
                                const confirmed = isLast
                                  ? window.confirm(
                                      'This is the last eval behind its criterion. Retiring it leaves the criterion uncovered. Continue?',
                                    )
                                  : window.confirm('Retire this eval?')
                                if (confirmed) {
                                  void onRetire(item.id)
                                }
                              }}
                            >
                              Retire
                            </button>
                          </div>
                        </div>
                        {expanded ? (
                          <div className="mt-3 border-t border-line pt-3">
                            {editing ? (
                              <EvalEditor
                                evalItem={item}
                                onCancel={() => setEditingId(null)}
                                onSave={async (draft) => {
                                  await onAmend({ evalId: item.id, ...draft })
                                  setEditingId(null)
                                }}
                              />
                            ) : (
                              <EvalDetail evalItem={item} />
                            )}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const EvalDetail = ({ evalItem }: { readonly evalItem: EvalSnapshot }) => (
  <div className="flex flex-col gap-3 text-sm text-fg">
    <DetailBlock label="Prompt" value={evalItem.prompt || '—'} />
    <DetailBlock label="Context" value={evalItem.context || '—'} />
    <div className="flex flex-col gap-2">
      <span className="text-xs tracking-[0.16em] text-muted uppercase">Checks</span>
      {evalItem.checks.length === 0 ? (
        <p className="text-muted">No checks yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {evalItem.checks.map((check) => (
            <li key={check.id}>{check.statement}</li>
          ))}
        </ul>
      )}
    </div>
  </div>
)

const DetailBlock = ({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs tracking-[0.16em] text-muted uppercase">{label}</span>
    <p className="whitespace-pre-wrap">{value}</p>
  </div>
)

type EvalDraft = {
  readonly scenario: string
  readonly prompt: string
  readonly context: string
  readonly checks: readonly CheckSnapshot[]
}

const EvalEditor = ({
  evalItem,
  onCancel,
  onSave,
}: {
  readonly evalItem: EvalSnapshot
  readonly onCancel: () => void
  readonly onSave: (draft: EvalDraft) => Promise<void>
}) => {
  const [scenario, setScenario] = useState(evalItem.scenario)
  const [prompt, setPrompt] = useState(evalItem.prompt)
  const [context, setContext] = useState(evalItem.context)
  const [checksText, setChecksText] = useState(
    evalItem.checks.map((check) => check.statement).join('\n'),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setScenario(evalItem.scenario)
    setPrompt(evalItem.prompt)
    setContext(evalItem.context)
    setChecksText(evalItem.checks.map((check) => check.statement).join('\n'))
  }, [evalItem])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const statements = checksText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (statements.length === 0) {
      setError('At least one check is required.')
      return
    }
    const existingByIndex = evalItem.checks
    const checks: CheckSnapshot[] = statements.map((statement, index) => ({
      id: existingByIndex[index]?.id ?? crypto.randomUUID(),
      statement,
    }))
    setSaving(true)
    try {
      await onSave({ scenario, prompt, context, checks })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save eval')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Scenario</span>
        <textarea
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
          rows={2}
          className="border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-signal-dim"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Prompt</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className="border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-signal-dim"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Context</span>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={3}
          className="border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-signal-dim"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">
          Checks (one per line)
        </span>
        <textarea
          value={checksText}
          onChange={(event) => setChecksText(event.target.value)}
          rows={4}
          className="border border-line bg-surface px-3 py-2 text-fg outline-none focus:border-signal-dim"
        />
      </label>
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-muted uppercase"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
