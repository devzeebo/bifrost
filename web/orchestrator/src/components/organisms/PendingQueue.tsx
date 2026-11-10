import type { TrackedWorkItem } from '../../workItems/types'
import { WorkItemRow } from './WorkItemRow'

type PendingQueueProps = {
  readonly items: readonly TrackedWorkItem[]
}

export const PendingQueue = ({ items }: PendingQueueProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Pending queue</h2>
    {items.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No pending tracked work items.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <WorkItemRow item={item} />
          </li>
        ))}
      </ul>
    )}
  </section>
)
