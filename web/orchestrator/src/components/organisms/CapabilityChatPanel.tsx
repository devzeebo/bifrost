import { useState, type FormEvent } from 'react'
import type { ChatMessage, Proposal } from '../../capabilities/types'
import { ProposalCard } from '../molecules/ProposalCard'

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
