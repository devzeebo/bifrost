import { formatTime, labelForFreshness, toneForFreshness, type Freshness } from '../../status/freshness'
import { NodeId } from '../atoms/NodeId'
import { StatusMark } from '../atoms/StatusMark'
import { Fact } from '../molecules/Fact'

export type WorkerRowProps = {
  readonly id: string
  readonly isAvailable: boolean
  readonly freshness: Freshness
  readonly lastHeartbeatAt: string | null
}

export const WorkerRow = ({ id, isAvailable, freshness, lastHeartbeatAt }: WorkerRowProps) => (
  <article className="grid items-center gap-4 border border-line bg-surface px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <NodeId id={id} />
      <StatusMark tone={toneForFreshness(freshness)} label={labelForFreshness(freshness)} />
    </div>
    <div className="flex flex-wrap gap-6">
      <Fact label="Availability" value={isAvailable ? 'Available' : 'Unavailable'} />
      <Fact label="Heartbeat" value={formatTime(lastHeartbeatAt)} />
    </div>
  </article>
)
