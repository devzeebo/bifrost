import { useEffect, useState } from 'react'
import {
  compareSkillVersions,
  getSkillVersion,
  listSkillVersions,
  restoreSkillVersion,
} from '../../capabilities/api'
import { diffLines } from '../../capabilities/diff'
import type { SkillVersionDetail, SkillVersionSummary } from '../../capabilities/types'

type DerivedSkillPanelProps = {
  readonly capabilityId: string
  readonly hasPublishedSkill: boolean
  readonly skillMarkdown: string
  readonly hasUnsavedSkillDraft: boolean
  readonly onRestored: () => Promise<void>
}

export const DerivedSkillPanel = ({
  capabilityId,
  hasPublishedSkill,
  skillMarkdown,
  hasUnsavedSkillDraft,
  onRestored,
}: DerivedSkillPanelProps) => {
  const [versions, setVersions] = useState<readonly SkillVersionSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SkillVersionDetail | null>(null)
  const [compareLeftId, setCompareLeftId] = useState('')
  const [compareRightId, setCompareRightId] = useState('')
  const [compare, setCompare] = useState<{
    readonly left: SkillVersionDetail
    readonly right: SkillVersionDetail
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    try {
      setVersions(await listSkillVersions(capabilityId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load skill versions')
    }
  }

  useEffect(() => {
    void reload()
  }, [capabilityId])

  const openVersion = async (versionId: string) => {
    setBusy(true)
    setCompare(null)
    try {
      setSelected(await getSkillVersion(capabilityId, versionId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open skill version')
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
      setCompare(await compareSkillVersions(capabilityId, compareLeftId, compareRightId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not compare skill versions')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (versionId: string) => {
    if (!window.confirm('Restore this skill version as a new draft? History will not be rewritten.')) {
      return
    }
    setBusy(true)
    try {
      await restoreSkillVersion({ id: capabilityId, versionId })
      await onRestored()
      await reload()
      setSelected(null)
      setCompare(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore skill version')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Derived skill</h2>
      <div className="flex flex-col gap-4 border border-line bg-surface px-5 py-6">
        <p className="text-sm text-muted">
          {hasPublishedSkill
            ? 'A skill version has been published for real work.'
            : versions.length === 0
              ? 'No derived skill yet. The skill is the workshop’s output after evals exist.'
              : 'Skill draft is edited through chat proposals; versions below are read-only.'}
        </p>

        {skillMarkdown || hasUnsavedSkillDraft ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs tracking-[0.12em] text-muted uppercase">Current draft</p>
            {hasUnsavedSkillDraft ? (
              <p className="text-sm text-muted">
                Draft restored from history — the next applied save records a new version.
              </p>
            ) : null}
            <pre className="whitespace-pre-wrap border border-line bg-ink px-3 py-3 text-sm text-fg">
              {skillMarkdown || '(empty)'}
            </pre>
          </div>
        ) : null}

        {versions.length > 0 ? (
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
        ) : null}

        {versions.length >= 2 ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">Compare</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                <span className="tracking-[0.12em] uppercase">Left</span>
                <select
                  value={compareLeftId}
                  onChange={(event) => setCompareLeftId(event.target.value)}
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
              <label className="flex flex-col gap-1 text-xs text-muted">
                <span className="tracking-[0.12em] uppercase">Right</span>
                <select
                  value={compareRightId}
                  onChange={(event) => setCompareRightId(event.target.value)}
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

        {selected ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">
              Skill version {shortId(selected.versionId)} · read only
            </p>
            <p className="text-xs text-muted">
              Derived against capability version{' '}
              {shortId(selected.snapshot.derivedAgainstCapabilityVersionId)}
            </p>
            <pre className="whitespace-pre-wrap border border-line bg-ink px-3 py-3 text-sm text-fg">
              {selected.snapshot.markdown}
            </pre>
          </div>
        ) : null}

        {compare ? (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <p className="text-xs tracking-[0.16em] text-muted uppercase">
              Compare {shortId(compare.left.versionId)} → {shortId(compare.right.versionId)}
            </p>
            <div className="flex flex-col gap-1 border border-line bg-ink px-3 py-3 font-mono text-sm">
              {diffLines(compare.left.snapshot.markdown, compare.right.snapshot.markdown).map(
                (row, index) => (
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
                ),
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

const formatTimestamp = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const shortId = (value: string) => value.slice(0, 8)
