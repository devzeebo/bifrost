import { useEffect, useState, type FormEvent } from 'react'

type AskDocumentProps = {
  readonly ask: string
  readonly name: string
  readonly hasUnsavedDraft: boolean
  readonly onSaveAsk: (ask: string) => Promise<void>
  readonly onSaveName: (name: string) => Promise<void>
}

export const AskDocument = ({
  ask,
  name,
  hasUnsavedDraft,
  onSaveAsk,
  onSaveName,
}: AskDocumentProps) => {
  const [draftAsk, setDraftAsk] = useState(ask)
  const [draftName, setDraftName] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraftAsk(ask)
  }, [ask])

  useEffect(() => {
    setDraftName(name)
  }, [name])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (draftName.trim() !== name) {
        await onSaveName(draftName)
      }
      if (draftAsk.trim() !== ask || hasUnsavedDraft) {
        await onSaveAsk(draftAsk)
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
        {error ? <p className="text-sm text-signal">{error}</p> : null}
        <button
          type="submit"
          disabled={!dirty || saving}
          className="self-start border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save ask'}
        </button>
      </form>
    </section>
  )
}
