import { formatTime, labelForFreshness, toneForFreshness, type Freshness } from '../../status/freshness'
import type { TrackedWorkItem } from '../../workItems/types'
import { NodeId } from '../atoms/NodeId'
import { StatusMark } from '../atoms/StatusMark'
import { Fact } from '../molecules/Fact'
import { WorkItemRow } from './WorkItemRow'

export type WorkerRowProps = {
  readonly id: string
  readonly isAvailable: boolean
  readonly freshness: Freshness
  readonly lastHeartbeatAt: string | null
  readonly held?: readonly TrackedWorkItem[]
}

export const WorkerRow = ({
  id,
  isAvailable,
  freshness,
  lastHeartbeatAt,
  held = [],
}: WorkerRowProps) => (
  <article className="flex flex-col gap-3 border border-line bg-surface px-5 py-4">
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NodeId id={id} />
        <StatusMark tone={toneForFreshness(freshness)} label={labelForFreshness(freshness)} />
      </div>
      <div className="flex flex-wrap gap-6">
        <Fact label="Availability" value={isAvailable ? 'Available' : 'Unavailable'} />
        <Fact label="Heartbeat" value={formatTime(lastHeartbeatAt)} />
      </div>
    </div>
    {held.length > 0 ? (
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <h3 className="text-xs tracking-[0.14em] text-muted uppercase">Held work</h3>
        <ul className="flex flex-col gap-2">
          {held.map((item) => (
            <li key={item.id}>
              <WorkItemRow item={item} />
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </article>
)
