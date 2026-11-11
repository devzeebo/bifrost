import { Link } from '@tanstack/react-router'
import type { WorkflowSummary } from '../../workflows/types'

type WorkflowLibraryProps = {
  readonly items: readonly WorkflowSummary[]
}

export const WorkflowLibrary = ({ items }: WorkflowLibraryProps) => {
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
        <li key={item.id} className="border-b border-line last:border-b-0">
          <Link
            to="/workflows/$workflowId"
            params={{ workflowId: item.id }}
            className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface"
          >
            <span className="text-fg">{item.name}</span>
            <span className="font-mono text-xs text-muted">{item.id.slice(0, 8)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
