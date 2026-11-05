import { useState, type FormEvent } from 'react'

type CreateCapabilityFormProps = {
  readonly onSubmit: (input: { readonly name: string; readonly ask: string }) => Promise<void>
}

export const CreateCapabilityForm = ({ onSubmit }: CreateCapabilityFormProps) => {
  const [name, setName] = useState('')
  const [ask, setAsk] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit({ name, ask })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create capability')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 border border-line bg-surface px-5 py-6">
      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border border-line bg-ink px-3 py-2 text-fg outline-none focus:border-signal-dim"
          required
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.16em] text-muted uppercase">Ask</span>
        <textarea
          value={ask}
          onChange={(event) => setAsk(event.target.value)}
          rows={8}
          className="border border-line bg-ink px-3 py-2 font-sans text-fg outline-none focus:border-signal-dim"
          placeholder="In plain language, what should the work do?"
          required
        />
      </label>
      {error ? <p className="text-sm text-signal">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="self-start border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create capability'}
      </button>
    </form>
  )
}
