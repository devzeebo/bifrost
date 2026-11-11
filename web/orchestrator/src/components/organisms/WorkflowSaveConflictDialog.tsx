import { useEffect, useRef } from 'react'

type WorkflowSaveConflictDialogProps = {
  readonly message: string
  readonly busy: boolean
  readonly onOverwrite: () => void
  readonly onDiscard: () => void
  readonly onCancel: () => void
}

export const WorkflowSaveConflictDialog = ({
  message,
  busy,
  onOverwrite,
  onDiscard,
  onCancel,
}: WorkflowSaveConflictDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = dialogRef.current
    const focusables = root ? focusableElements(root) : []
    focusables[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busy) {
          onCancel()
        }
        return
      }
      if (event.key !== 'Tab' || !root) {
        return
      }
      const items = focusableElements(root)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
        return
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [busy, onCancel])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-conflict-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4"
    >
      <div className="flex w-full max-w-md flex-col gap-5 border border-line bg-surface px-5 py-6">
        <div className="flex flex-col gap-2">
          <h2 id="workflow-conflict-title" className="text-lg text-fg">
            Workflow changed since it was opened
          </h2>
          <p className="text-sm text-muted">{message}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={onOverwrite}
            className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase disabled:opacity-50"
          >
            Overwrite record
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDiscard}
            className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-fg uppercase disabled:opacity-50"
          >
            Discard local drawing
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-muted uppercase disabled:opacity-50"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  )
}

const focusableElements = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
