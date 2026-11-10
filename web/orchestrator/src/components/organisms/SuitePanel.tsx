import { useState, type FormEvent } from 'react'
import {
  formatCriterionRollup,
  formatSuiteSummary,
  neverRunOutcome,
  outcomeEarnedUnderNote,
  outcomeLabel,
} from '../../capabilities/evalOutcome'
import type { SkillTarget } from '../../capabilities/useEvalRuns'
import type {
  CheckKind,
  CheckSnapshot,
  CriterionEvalRollup,
  CriterionSnapshot,
  EvalCaseRun,
  EvalLatestOutcome,
  EvalSnapshot,
  SkillVersionSummary,
  SuiteEvalSummary,
} from '../../capabilities/types'

const emptyBusyEvalIds: ReadonlySet<string> = new Set()

type SuitePanelProps = {
  readonly criteria: readonly CriterionSnapshot[]
  readonly evals: readonly EvalSnapshot[]
  readonly currentCapabilityVersionId: string | null
  readonly currentSkillVersionId: string | null
  readonly outcomes?: ReadonlyMap<string, EvalLatestOutcome>
  readonly caseRuns?: ReadonlyMap<string, EvalCaseRun>
  readonly criterionRollups?: ReadonlyMap<string, CriterionEvalRollup>
  readonly suiteSummary?: SuiteEvalSummary
  readonly skillVersions?: readonly SkillVersionSummary[]
  readonly skillTarget?: SkillTarget
  readonly onSkillTargetChange?: (target: SkillTarget) => void
  readonly busyEvalIds?: ReadonlySet<string>
  readonly suiteBusy?: boolean
  readonly canCancelSuite?: boolean
  readonly runError?: string | null
  readonly onRunCase?: (evalId: string) => Promise<void>
  readonly onRunSuite?: () => Promise<void>
  readonly onCancelSuite?: () => Promise<void>
  readonly onAmend: (input: {
    readonly evalId: string
    readonly scenario: string
    readonly prompt: string
    readonly context: string
    readonly checks?: readonly CheckSnapshot[] | null
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
  caseRuns,
  criterionRollups,
  suiteSummary,
  skillVersions = [],
  skillTarget = 'draft',
  onSkillTargetChange,
  busyEvalIds = emptyBusyEvalIds,
  suiteBusy = false,
  canCancelSuite = false,
  runError = null,
  onRunCase,
  onRunSuite,
  onCancelSuite,
  onAmend,
  onDuplicate,
  onRetire,
}: SuitePanelProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openScriptId, setOpenScriptId] = useState<string | null>(null)
  const [kindError, setKindError] = useState<string | null>(null)
  const [kindBusyKey, setKindBusyKey] = useState<string | null>(null)
  const anyCaseBusy = busyEvalIds.size > 0

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

  const setCheckKind = async (evalItem: EvalSnapshot, checkId: string, kind: CheckKind) => {
    const busyKey = `${evalItem.id}:${checkId}`
    if (kindBusyKey !== null) {
      return
    }
    setKindError(null)
    setKindBusyKey(busyKey)
    const checks = evalItem.checks.map((check) =>
      check.id === checkId
        ? {
            ...check,
            kind,
            script: kind === 'HumanReview' ? null : check.script,
          }
        : check,
    )
    try {
      await onAmend({
        evalId: evalItem.id,
        scenario: evalItem.scenario,
        prompt: evalItem.prompt,
        context: evalItem.context,
        checks,
      })
    } catch (err) {
      setKindError(err instanceof Error ? err.message : 'Could not update check kind')
    } finally {
      setKindBusyKey(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Suite</h2>
      <div className="flex flex-col gap-4 border border-line bg-surface px-5 py-6">
        <div className="flex flex-col gap-3 border border-line bg-ink px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg">
              {suiteSummary ? formatSuiteSummary(suiteSummary) : 'No suite results yet'}
            </p>
            <div className="flex flex-wrap gap-2">
              {onRunSuite ? (
                <button
                  type="button"
                  disabled={suiteBusy || anyCaseBusy || evals.length === 0}
                  className="border border-signal-dim px-3 py-1 text-xs tracking-[0.12em] text-signal uppercase disabled:opacity-50"
                  onClick={() => void onRunSuite()}
                >
                  {suiteBusy ? 'Running suite…' : 'Run suite'}
                </button>
              ) : null}
              {canCancelSuite && onCancelSuite ? (
                <button
                  type="button"
                  className="border border-line px-3 py-1 text-xs tracking-[0.12em] text-signal uppercase"
                  onClick={() => void onCancelSuite()}
                >
                  Cancel suite
                </button>
              ) : null}
            </div>
          </div>
          {onSkillTargetChange ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs tracking-[0.16em] text-muted uppercase">Skill target</span>
              <select
                value={skillTarget}
                disabled={suiteBusy || anyCaseBusy}
                onChange={(event) => onSkillTargetChange(event.target.value)}
                className="border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-signal-dim disabled:opacity-50"
              >
                <option value="draft">Current draft</option>
                {skillVersions.map((version) => (
                  <option key={version.versionId} value={version.versionId}>
                    Skill {version.versionId.slice(0, 8)} · {version.recordedAt}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {runError ? <p className="text-sm text-signal">{runError}</p> : null}
        </div>
        {kindError ? <p className="text-sm text-signal">{kindError}</p> : null}
        {criteria.map((criterion) => {
          const covering = evals.filter((item) => item.criterionId === criterion.id)
          const rollup = criterionRollups?.get(criterion.id)
          return (
            <div key={criterion.id} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm text-fg">{criterion.statement}</h3>
                {rollup ? (
                  <p className="text-xs tracking-[0.12em] text-muted uppercase">
                    {formatCriterionRollup(rollup)}
                  </p>
                ) : null}
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
                    const caseRun = caseRuns?.get(item.id) ?? null
                    const caseBusy = busyEvalIds.has(item.id)
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
                            {onRunCase ? (
                              <button
                                type="button"
                                disabled={caseBusy || suiteBusy}
                                className="border border-signal-dim px-3 py-1 text-xs tracking-[0.12em] text-signal uppercase disabled:opacity-50"
                                onClick={() => void onRunCase(item.id)}
                              >
                                {caseBusy ? 'Running…' : 'Run'}
                              </button>
                            ) : null}
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
                                key={item.id}
                                evalItem={item}
                                onCancel={() => setEditingId(null)}
                                onSave={async (draft) => {
                                  await onAmend({
                                    evalId: item.id,
                                    ...draft,
                                  })
                                  setEditingId(null)
                                }}
                              />
                            ) : (
                              <>
                                <EvalDetail
                                  evalItem={item}
                                  openScriptId={openScriptId}
                                  kindBusyKey={kindBusyKey}
                                  onToggleScript={(checkId) =>
                                    setOpenScriptId((current) =>
                                      current === checkId ? null : checkId,
                                    )
                                  }
                                  onSetKind={(checkId, kind) => void setCheckKind(item, checkId, kind)}
                                />
                                {caseRun ? <EvalRunDetail run={caseRun} /> : null}
                              </>
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

const EvalRunDetail = ({ run }: { readonly run: EvalCaseRun }) => (
  <div className="mt-4 flex flex-col gap-3 border border-line bg-surface px-3 py-3 text-sm text-fg">
    <div className="flex flex-wrap gap-3 text-xs tracking-[0.12em] text-muted uppercase">
      <span>{run.isEval ? 'Eval run' : 'Run'}</span>
      <span>{run.status}</span>
      {run.outcome ? <span>{run.outcome}</span> : null}
      {run.spend ? (
        <span>
          {run.spend.model} · {run.spend.totalTokens} tokens
          {run.spend.cost != null ? ` · $${run.spend.cost}` : ''}
        </span>
      ) : null}
    </div>
    {run.failureReason ? <p className="text-sm text-signal">{run.failureReason}</p> : null}
    {run.transcript.length > 0 ? (
      <div className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Transcript</span>
        <div className="flex flex-col gap-2">
          {run.transcript.map((line, index) => (
            <div key={`${line.role}-${index}`} className="border border-line bg-ink px-3 py-2">
              <p className="text-xs tracking-[0.12em] text-muted uppercase">{line.role}</p>
              <p className="whitespace-pre-wrap">{line.text}</p>
            </div>
          ))}
        </div>
      </div>
    ) : null}
    {run.checks.length > 0 ? (
      <div className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Check verdicts</span>
        <ul className="flex flex-col gap-2">
          {run.checks.map((check) => (
            <li key={check.checkId} className="border border-line bg-ink px-3 py-2">
              <p className="text-xs tracking-[0.12em] text-muted uppercase">
                {check.kind} · {check.status} · {check.checkId.slice(0, 8)}
              </p>
              <p>{check.statement}</p>
              <p className="text-muted">{check.reason}</p>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </div>
)

const EvalDetail = ({
  evalItem,
  openScriptId,
  kindBusyKey,
  onToggleScript,
  onSetKind,
}: {
  readonly evalItem: EvalSnapshot
  readonly openScriptId: string | null
  readonly kindBusyKey: string | null
  readonly onToggleScript: (checkId: string) => void
  readonly onSetKind: (checkId: string, kind: CheckKind) => void
}) => (
  <div className="flex flex-col gap-3 text-sm text-fg">
    <DetailBlock label="Prompt" value={evalItem.prompt || '—'} />
    <DetailBlock label="Context" value={evalItem.context || '—'} />
    <div className="flex flex-col gap-2">
      <span className="text-xs tracking-[0.16em] text-muted uppercase">Checks</span>
      {evalItem.checks.length === 0 ? (
        <p className="text-muted">No checks yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {evalItem.checks.map((check) => {
            const busy = kindBusyKey === `${evalItem.id}:${check.id}`
            const anyKindBusy = kindBusyKey !== null
            return (
              <li
                key={check.id}
                className="flex flex-col gap-2 border border-line bg-surface px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs tracking-[0.12em] text-muted uppercase">
                      {check.kind}
                      {check.kind === 'Script' && check.timeoutMs != null
                        ? ` · ${check.timeoutMs}ms`
                        : ''}
                    </span>
                    <span>{check.statement}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {check.kind === 'Script' ? (
                      <>
                        <button
                          type="button"
                          className="border border-line px-2 py-1 text-xs tracking-[0.12em] text-muted uppercase"
                          onClick={() => onToggleScript(check.id)}
                        >
                          {openScriptId === check.id ? 'Hide script' : 'Open script'}
                        </button>
                        <button
                          type="button"
                          disabled={anyKindBusy}
                          className="border border-line px-2 py-1 text-xs tracking-[0.12em] text-muted uppercase disabled:opacity-50"
                          onClick={() => onSetKind(check.id, 'HumanReview')}
                        >
                          {busy ? 'Updating…' : 'Use human review'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={anyKindBusy}
                        className="border border-line px-2 py-1 text-xs tracking-[0.12em] text-muted uppercase disabled:opacity-50"
                        onClick={() => onSetKind(check.id, 'Script')}
                      >
                        {busy ? 'Updating…' : 'Use script check'}
                      </button>
                    )}
                  </div>
                </div>
                {check.kind === 'Script' && openScriptId === check.id ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap border border-line bg-ink px-3 py-2 text-xs text-fg">
                    {check.script?.trim() ? check.script : 'Script not authored yet.'}
                  </pre>
                ) : null}
              </li>
            )
          })}
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
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (scenario.trim().length === 0) {
      setError('Scenario is required.')
      return
    }
    setSaving(true)
    try {
      await onSave({ scenario, prompt, context })
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
      <p className="text-xs text-muted">
        Checks are authored behind the scenes. Changing the scenario re-derives script checks.
      </p>
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
