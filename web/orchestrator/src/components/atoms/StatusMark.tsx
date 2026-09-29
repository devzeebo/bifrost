import type { StatusTone } from '../../status/freshness'

const markClass: Record<StatusTone, string> = {
  live: 'bg-signal',
  stale: 'bg-signal-dim',
  quiet: 'bg-muted',
}

const labelClass: Record<StatusTone, string> = {
  live: 'text-signal',
  stale: 'text-signal-dim',
  quiet: 'text-muted',
}

type StatusMarkProps = {
  readonly tone: StatusTone
  readonly label: string
}

export const StatusMark = ({ tone, label }: StatusMarkProps) => (
  <span className="inline-flex items-center gap-2 text-sm">
    <span aria-hidden="true" className={`size-2 shrink-0 ${markClass[tone]}`} />
    <span className={labelClass[tone]}>{label}</span>
  </span>
)
