import { Link } from '@tanstack/react-router'
import type { TrackedWorkItem } from '../../workItems/types'
import { NodeId } from '../atoms/NodeId'
import { StatusMark } from '../atoms/StatusMark'
import { Fact } from '../molecules/Fact'

type WorkItemRowProps = {
  readonly item: TrackedWorkItem
}

const toneForStatus = (status: TrackedWorkItem['status']) => {
  switch (status) {
    case 'pending':
      return 'stale' as const
    case 'claimed':
    case 'running':
      return 'live' as const
    case 'succeeded':
      return 'live' as const
    case 'failed':
    case 'canceled':
      return 'quiet' as const
  }
}

export const WorkItemRow = ({ item }: WorkItemRowProps) => (
  <Link
    to="/work-items/$workItemId"
    params={{ workItemId: item.id }}
    className="grid items-center gap-4 border border-line bg-surface px-5 py-4 no-underline sm:grid-cols-[minmax(0,1fr)_auto]"
  >
    <div className="flex flex-wrap items-center justify-between gap-3">
      <NodeId id={item.id} />
      <StatusMark tone={toneForStatus(item.status)} label={item.status} />
    </div>
    <div className="flex flex-wrap gap-6">
      <Fact label="Holder" value={item.holderId === null ? '—' : item.holderId.slice(0, 8)} />
    </div>
  </Link>
)
