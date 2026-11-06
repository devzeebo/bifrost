import { useEffect, useState } from 'react'
import {
  compareCapabilityVersions,
  getCapabilityVersion,
  listCapabilityVersions,
  restoreCapabilityVersion,
} from '../../capabilities/api'
import { diffCriteria, diffLines, evalCountByCriterion } from '../../capabilities/diff'
import type {
  CapabilityVersionDetail,
  VersionSummary,
} from '../../capabilities/types'

type CapabilityVersionPanelProps = {
  readonly capabilityId: string
  readonly onRestored: () => Promise<void>
}

export const CapabilityVersionPanel = ({
  capabilityId,
  onRestored,
}: CapabilityVersionPanelProps) => {
  const [versions, setVersions] = useState<readonly VersionSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CapabilityVersionDetail | null>(null)
  const [compareLeftId, setCompareLeftId] = useState<string>('')
  const [compareRightId, setCompareRightId] = useState<string>('')
  const [compare, setCompare] = useState<{
    readonly left: CapabilityVersionDetail
    readonly right: CapabilityVersionDetail
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    try {
      const items = await listCapabilityVersions(capabilityId)
      setVersions(items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load versions')
    }
  }

  useEffect(() => {
    void reload()
  }, [capabilityId])

  const openVersion = async (versionId: string) => {
    setBusy(true)
    setCompare(null)
    try {
      setSelected(await getCapabilityVersion(capabilityId, versionId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open version')
    } finally {
      setBusy(false)
    }
  }

  const runCompare = async () => {
    if (!compareLeftId || !compareRightId) {
      return
    }
    setBusy(true)
    setSelected(null)
    try {
      setCompare(await compareCapabilityVersions(capabilityId, compareLeftId, compareRightId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not compare versions')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (versionId: string) => {
    if (!window.confirm('Restore this version as a new draft? History will not be rewritten.')) {
      return
    }
    setBusy(true)
    try {
      await restoreCapabilityVersion({ id: capabilityId, versionId })
      await onRestored()
      await reload()
      setSelected(null)
      setCompare(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore version')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Capability versions</h2>
      <div className="flex flex-col gap-4 border border-line bg-surface px-5 py-6">
        {versions.length === 0 ? (
          <p className="text-sm text-muted">No versions recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {versions.map((version) => (
              <li
                key={version.versionId}
                className="flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2"
              >
                <button
                  type="button"
                  className="text-left text-sm text-fg hover:text-signal"
                  disabled={busy}
                  onClick={() => void openVersion(version.versionId)}
                >
                  {formatTimestamp(version.recordedAt)}
                  <span className="ml-2 text-xs text-muted">{shortId(version.versionId)}</span>
                </button>
                <button
                  type="button"
                  className="text-xs tracking-[0.12em] text-signal uppercase disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void restore(version.versionId)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}

        {versions.length >= 2 ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">Compare</p>
            <div className="flex flex-wrap gap-3">
              <VersionSelect
                label="Left"
                value={compareLeftId}
                versions={versions}
                onChange={setCompareLeftId}
              />
              <VersionSelect
                label="Right"
                value={compareRightId}
                versions={versions}
                onChange={setCompareRightId}
              />
              <button
                type="button"
                className="border border-signal-dim px-3 py-2 text-xs tracking-[0.12em] text-signal uppercase disabled:opacity-50"
                disabled={busy || !compareLeftId || !compareRightId}
                onClick={() => void runCompare()}
              >
                Show differences
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-signal">{error}</p> : null}

        {selected ? <CapabilityVersionReadOnly detail={selected} /> : null}
        {compare ? <CapabilityVersionCompare left={compare.left} right={compare.right} /> : null}
      </div>
    </section>
  )
}

const VersionSelect = ({
  label,
  value,
  versions,
  onChange,
}: {
  readonly label: string
  readonly value: string
  readonly versions: readonly VersionSummary[]
  readonly onChange: (value: string) => void
}) => (
  <label className="flex flex-col gap-1 text-xs text-muted">
    <span className="tracking-[0.12em] uppercase">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border border-line bg-ink px-2 py-2 text-sm text-fg"
    >
      <option value="">Select…</option>
      {versions.map((version) => (
        <option key={version.versionId} value={version.versionId}>
          {formatTimestamp(version.recordedAt)} ({shortId(version.versionId)})
        </option>
      ))}
    </select>
  </label>
)

const CapabilityVersionReadOnly = ({ detail }: { readonly detail: CapabilityVersionDetail }) => (
  <div className="flex flex-col gap-3 border-t border-line pt-4">
    <p className="text-xs tracking-[0.16em] text-muted uppercase">
      Version {shortId(detail.versionId)} · read only
    </p>
    <pre className="whitespace-pre-wrap border border-line bg-ink px-3 py-3 text-sm text-fg">
      {detail.snapshot.ask}
    </pre>
    <p className="text-sm text-muted">
      Criteria: {detail.snapshot.criteria.length} · Evals: {detail.snapshot.evals.length}
    </p>
    {detail.snapshot.criteria.length > 0 ? (
      <ul className="flex flex-col gap-2 text-sm text-fg">
        {detail.snapshot.criteria.map((criterion) => (
          <li key={criterion.id} className="border border-line px-3 py-2">
            {criterion.statement}
          </li>
        ))}
      </ul>
    ) : null}
  </div>
)

const CapabilityVersionCompare = ({
  left,
  right,
}: {
  readonly left: CapabilityVersionDetail
  readonly right: CapabilityVersionDetail
}) => {
  const askDiff = diffLines(left.snapshot.ask, right.snapshot.ask)
  const criteria = diffCriteria(left.snapshot.criteria, right.snapshot.criteria)
  const leftEvalCounts = evalCountByCriterion(left.snapshot.evals)
  const rightEvalCounts = evalCountByCriterion(right.snapshot.evals)

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">
        Compare {shortId(left.versionId)} → {shortId(right.versionId)}
      </p>
      <div>
        <h3 className="mb-2 text-xs tracking-[0.12em] text-muted uppercase">Ask</h3>
        <div className="flex flex-col gap-1 border border-line bg-ink px-3 py-3 font-mono text-sm">
          {askDiff.map((row, index) => (
            <span
              key={`${row.kind}-${index}`}
              className={
                row.kind === 'added'
                  ? 'text-signal'
                  : row.kind === 'removed'
                    ? 'text-muted line-through'
                    : 'text-fg'
              }
            >
              {row.kind === 'added' ? '+ ' : row.kind === 'removed' ? '- ' : '  '}
              {row.text || ' '}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs tracking-[0.12em] text-muted uppercase">Criteria</h3>
        {criteria.length === 0 ? (
          <p className="text-sm text-muted">No criteria in either version.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {criteria.map((row) => (
              <li key={row.id} className="border border-line px-3 py-2">
                <p className="text-xs text-muted">{shortId(row.id)}</p>
                <p className="text-muted line-through">{row.leftStatement ?? '—'}</p>
                <p className="text-fg">{row.rightStatement ?? '—'}</p>
                <p className="mt-1 text-xs text-muted">
                  Evals: {leftEvalCounts.get(row.id) ?? 0} → {rightEvalCounts.get(row.id) ?? 0}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const formatTimestamp = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const shortId = (value: string) => value.slice(0, 8)
