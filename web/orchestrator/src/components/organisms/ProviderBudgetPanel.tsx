import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Fact } from '../molecules/Fact'
import type { ProviderConfig } from '../../usage/virtualKeyQuota'

type ProviderBudgetPanelProps = {
  readonly providers: readonly ProviderConfig[]
}

const chartInk = '#1f2733'
const chartFg = '#e8eef5'
const chartMuted = '#9aa6b5'
const chartSignal = '#5fd4b8'

export const ProviderBudgetPanel = ({ providers }: ProviderBudgetPanelProps) => {
  const rows = providers.flatMap((provider) =>
    provider.budgets.map((budget) => ({
      id: budget.id || `${provider.id}-${budget.resetDuration}-${budget.maxLimit}`,
      label: `${provider.provider} · ${budget.resetDuration || 'n/a'}`,
      provider: provider.provider,
      resetDuration: budget.resetDuration,
      currentUsage: budget.currentUsage,
      maxLimit: budget.maxLimit,
    })),
  )

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Provider budgets</h2>
      {rows.length === 0 ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
          No provider budgets for this key.
        </p>
      ) : (
        <div className="border border-line bg-surface px-5 py-5">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartMuted} strokeOpacity={0.2} vertical={false} />
              <XAxis dataKey="label" stroke={chartMuted} tick={{ fill: chartMuted, fontSize: 12 }} />
              <YAxis stroke={chartMuted} tick={{ fill: chartMuted, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: chartInk,
                  border: '1px solid #4a5565',
                  color: chartFg,
                }}
              />
              <Bar dataKey="currentUsage" fill={chartSignal} name="Usage (USD)" />
            </BarChart>
          </ResponsiveContainer>
          <ul className="mt-5 flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap gap-6">
                <Fact label="Provider" value={row.provider} />
                <Fact label="Reset" value={row.resetDuration || 'n/a'} />
                <Fact label="Usage" value={formatUsd(row.currentUsage)} />
                <Fact label="Limit" value={formatUsd(row.maxLimit)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const formatUsd = (value: number): string =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 4,
  })
