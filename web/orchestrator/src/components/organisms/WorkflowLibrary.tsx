import { Link } from '@tanstack/react-router'
import type { WorkflowSummary } from '../../workflows/types'

type WorkflowLibraryProps = {
  readonly items: readonly WorkflowSummary[]
  readonly onDelete: (id: string) => void
}

export const WorkflowLibrary = ({ items, onDelete }: WorkflowLibraryProps) => {
  if (items.length === 0) {
    return (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No workflows yet. Create one to place nodes on the canvas.
      </p>
    )
  }

  return (
    <ul className="flex flex-col border border-line">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0 hover:bg-surface"
        >
          <Link
            to="/workflows/$workflowId"
            params={{ workflowId: item.id }}
            className="flex min-w-0 flex-1 items-center justify-between gap-4"
          >
            <span className="text-fg">{item.name}</span>
            <span className="font-mono text-xs text-muted">{item.id.slice(0, 8)}</span>
          </Link>
          <button
            type="button"
            className="border border-line px-3 py-1 text-xs tracking-[0.12em] text-signal uppercase"
            onClick={() => {
              onDelete(item.id)
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
