import { Fact } from '../molecules/Fact'
import type { Budget } from '../../usage/virtualKeyQuota'

type BudgetPanelProps = {
  readonly budgets: readonly Budget[]
}

export const BudgetPanel = ({ budgets }: BudgetPanelProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Budgets</h2>
    {budgets.length === 0 ? (
      <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
        No budgets are configured for this key.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">
        {budgets.map((budget) => {
          const remaining = Math.max(budget.maxLimit - budget.currentUsage, 0)
          const pct =
            budget.maxLimit > 0
              ? Math.min((budget.currentUsage / budget.maxLimit) * 100, 100)
              : 0
          return (
            <li key={budget.id} className="border border-line bg-surface px-5 py-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-6">
                  <Fact label="Usage" value={formatUsd(budget.currentUsage)} />
                  <Fact label="Limit" value={formatUsd(budget.maxLimit)} />
                  <Fact label="Remaining" value={formatUsd(remaining)} />
                  <Fact label="Reset" value={budget.resetDuration} />
                  <Fact label="Last reset" value={formatTimestamp(budget.lastReset)} />
                </div>
                <div className="h-2 w-full overflow-hidden bg-ink">
                  <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    )}
  </section>
)

const formatUsd = (value: number): string =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  })

const formatTimestamp = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}
