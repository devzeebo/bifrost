import { StatusMark } from '../atoms/StatusMark'
import type { StatusTone } from '../../status/freshness'

type PodIdentityProps = {
  readonly role: string
  readonly tone: StatusTone
  readonly status: string
  readonly detail?: string
}

export const PodIdentity = ({ role, tone, status, detail }: PodIdentityProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h2 className="text-lg font-medium tracking-tight text-fg">{role}</h2>
      <StatusMark tone={tone} label={status} />
    </div>
    {detail !== undefined ? <p className="text-sm text-muted">{detail}</p> : null}
  </div>
)
