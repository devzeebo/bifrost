import { formatTime } from '../../status/freshness'

type TimeLabelProps = {
  readonly at: string | null
}

export const TimeLabel = ({ at }: TimeLabelProps) => {
  const formatted = formatTime(at)
  if (at === null || formatted === '—') {
    return <span className="font-mono text-sm tabular-nums text-muted">{formatted}</span>
  }
  return (
    <time dateTime={at} className="font-mono text-sm tabular-nums text-fg">
      {formatted}
    </time>
  )
}
