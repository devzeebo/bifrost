import { Fact } from '../molecules/Fact'
import type { RateLimit } from '../../usage/virtualKeyQuota'

export type ScopedRateLimit = RateLimit & {
  readonly scopeLabel: string
}

type RateLimitPanelProps = {
  readonly limits: readonly ScopedRateLimit[]
}

export const RateLimitPanel = ({ limits }: RateLimitPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Rate limits</h2>
    {limits.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No rate limits are configured for this key.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {limits.map((limit) => (
          <li
            key={`${limit.scopeLabel}-${limit.id}`}
            className="border border-line bg-surface px-5 py-5"
          >
            <div className="flex flex-col gap-5">
              <Fact label="Scope" value={limit.scopeLabel} />
              <UsageBar
                label="Tokens"
                current={limit.tokenCurrentUsage}
                max={limit.tokenMaxLimit}
                reset={limit.tokenResetDuration}
              />
              <UsageBar
                label="Requests"
                current={limit.requestCurrentUsage}
                max={limit.requestMaxLimit}
                reset={limit.requestResetDuration}
              />
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
)

type UsageBarProps = {
  readonly label: string
  readonly current: number
  readonly max: number | null
  readonly reset: string | null
}

const UsageBar = ({ label, current, max, reset }: UsageBarProps) => {
  const pct = max !== null && max > 0 ? Math.min((current / max) * 100, 100) : 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-6">
        <Fact label={label} value={current.toLocaleString()} />
        <Fact label="Limit" value={max === null ? 'Unlimited' : max.toLocaleString()} />
        {reset !== null ? <Fact label="Reset" value={reset} /> : null}
      </div>
      {max !== null ? (
        <div className="h-2 w-full overflow-hidden bg-ink">
          <div className="h-full bg-signal-dim" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}
