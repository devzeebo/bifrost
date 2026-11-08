import { PodIdentity } from '../molecules/PodIdentity'
import type { VirtualKeyQuota } from '../../usage/virtualKeyQuota'

type QuotaIdentityProps = {
  readonly quota: VirtualKeyQuota
}

export const QuotaIdentity = ({ quota }: QuotaIdentityProps) => {
  const cycle = quota.budgets[0]
  return (
    <section className="flex flex-col gap-5 border border-line bg-surface px-5 py-5">
      <PodIdentity
        role={quota.virtualKeyName}
        tone={quota.isActive ? 'live' : 'quiet'}
        status={quota.isActive ? 'Active' : 'Inactive'}
        detail={
          cycle === undefined
            ? 'Current-cycle usage for the configured virtual key.'
            : `Cycle ${cycle.resetDuration} · last reset ${formatTimestamp(cycle.lastReset)}`
        }
      />
    </section>
  )
}

const formatTimestamp = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}
