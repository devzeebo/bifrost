type WorkflowSaveConflictDialogProps = {
  readonly message: string
  readonly onOverwrite: () => void
  readonly onDiscard: () => void
  readonly onCancel: () => void
}

export const WorkflowSaveConflictDialog = ({
  message,
  onOverwrite,
  onDiscard,
  onCancel,
}: WorkflowSaveConflictDialogProps) => (
  <div
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
          onClick={onOverwrite}
          className="border border-signal-dim px-4 py-2 text-xs tracking-[0.16em] text-signal uppercase"
        >
          Overwrite record
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-fg uppercase"
        >
          Discard local drawing
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-line px-4 py-2 text-xs tracking-[0.16em] text-muted uppercase"
        >
          Keep editing
        </button>
      </div>
    </div>
  </div>
)
