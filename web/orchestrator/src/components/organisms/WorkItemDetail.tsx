import type { TrackedWorkItem } from '../../workItems/types'
import { isActiveStatus, isHeldStatus } from '../../workItems/types'
import { NodeId } from '../atoms/NodeId'
import { StatusMark } from '../atoms/StatusMark'
import { Fact } from '../molecules/Fact'

type WorkItemDetailProps = {
  readonly item: TrackedWorkItem
  readonly actionPending: boolean
  readonly actionError: string | null
  readonly onCancel: () => void
  readonly onRelease: () => void
}

const toneForStatus = (status: TrackedWorkItem['status']) => {
  switch (status) {
    case 'pending':
      return 'stale' as const
    case 'claimed':
    case 'running':
    case 'succeeded':
      return 'live' as const
    case 'failed':
    case 'canceled':
      return 'quiet' as const
  }
}

export const WorkItemDetail = ({
  item,
  actionPending,
  actionError,
  onCancel,
  onRelease,
}: WorkItemDetailProps) => {
  const canCancel = isActiveStatus(item.status)
  const canRelease = isHeldStatus(item.status)

  return (
    <section className="flex flex-col gap-4 border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NodeId id={item.id} />
        <StatusMark tone={toneForStatus(item.status)} label={item.status} />
      </div>
      <div className="flex flex-wrap gap-6">
        <Fact label="Status" value={item.status} />
        <Fact label="Holder" value={item.holderId === null ? '—' : item.holderId.slice(0, 8)} />
      </div>
      {canCancel || canRelease ? (
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          {canRelease ? (
            <button
              type="button"
              className="border border-line px-4 py-2 text-sm text-fg hover:border-signal disabled:opacity-50"
              disabled={actionPending}
              onClick={onRelease}
            >
              Release
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="border border-line px-4 py-2 text-sm text-fg hover:border-signal disabled:opacity-50"
              disabled={actionPending}
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {actionError !== null ? <p className="text-sm text-muted">{actionError}</p> : null}
    </section>
  )
}
