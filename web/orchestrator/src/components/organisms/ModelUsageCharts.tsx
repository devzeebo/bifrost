import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Budget, ModelUsage } from '../../usage/virtualKeyQuota'

type ModelUsageChartsProps = {
  readonly budgets: readonly Budget[]
}

const chartInk = '#1f2733'
const chartFg = '#e8eef5'
const chartMuted = '#9aa6b5'
const chartSignal = '#5fd4b8'
const chartSignalDim = '#3f9f8d'

export const ModelUsageCharts = ({ budgets }: ModelUsageChartsProps) => {
  const windows = budgets
    .map((budget) => ({
      budget,
      rows: modelRows(budget.perModelUsage),
    }))
    .filter((window) => window.rows.length > 0)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Per-model usage</h2>
      {windows.length === 0 ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">
          No per-model usage for the current cycle.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {windows.map(({ budget, rows }) => (
            <div key={budget.id} className="flex flex-col gap-3">
              <h3 className="text-sm text-fg">
                {budgetScopeLabel(budget)} · reset {budget.resetDuration || 'n/a'}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Cost (USD)">
                  <UsageChart rows={rows} dataKey="totalCost" fill={chartSignal} name="Cost" />
                </ChartCard>
                <ChartCard title="Tokens">
                  <UsageChart
                    rows={rows}
                    dataKey="totalTokens"
                    fill={chartSignalDim}
                    name="Tokens"
                  />
                </ChartCard>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

type ChartCardProps = {
  readonly title: string
  readonly children: ReactNode
}

const ChartCard = ({ title, children }: ChartCardProps) => (
  <div className="border border-line bg-surface px-5 py-5">
    <h3 className="mb-4 text-sm text-fg">{title}</h3>
    {children}
  </div>
)

type ModelRow = {
  readonly id: string
  readonly provider: string
  readonly modelName: string
  readonly totalCost: number
  readonly totalTokens: number
  readonly totalRequests: number
}

type UsageChartProps = {
  readonly rows: readonly ModelRow[]
  readonly dataKey: 'totalCost' | 'totalTokens'
  readonly fill: string
  readonly name: string
}

const UsageChart = ({ rows, dataKey, fill, name }: UsageChartProps) => (
  <ResponsiveContainer width="100%" height={280}>
    <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
      <CartesianGrid stroke={chartMuted} strokeOpacity={0.2} vertical={false} />
      <XAxis
        dataKey="id"
        stroke={chartMuted}
        tick={<ModelTick rows={rows} />}
        interval={0}
        height={64}
        tickLine={false}
      />
      <YAxis stroke={chartMuted} tick={{ fill: chartMuted, fontSize: 12 }} />
      <Tooltip
        contentStyle={{
          background: chartInk,
          border: '1px solid #4a5565',
          color: chartFg,
        }}
        labelFormatter={(_, payload) => {
          const row = payload[0]?.payload as ModelRow | undefined
          if (row === undefined) {
            return ''
          }
          return `${row.provider}\n${row.modelName}`
        }}
      />
      <Bar dataKey={dataKey} fill={fill} name={name} />
    </BarChart>
  </ResponsiveContainer>
)

type ModelTickProps = {
  readonly x?: number
  readonly y?: number
  readonly payload?: { readonly value?: string }
  readonly rows: readonly ModelRow[]
}

const ModelTick = ({ x = 0, y = 0, payload, rows }: ModelTickProps) => {
  const row = rows.find((entry) => entry.id === payload?.value)
  if (row === undefined) {
    return null
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-56} y={4} width={112} height={56}>
        <div className="border border-line bg-ink px-2 py-1.5 text-center">
          <div className="truncate text-[11px] leading-tight text-muted">{row.provider}</div>
          <div className="truncate text-xs leading-tight text-fg">{row.modelName}</div>
        </div>
      </foreignObject>
    </g>
  )
}

const modelRows = (usages: readonly ModelUsage[]): readonly ModelRow[] =>
  [...usages]
    .map((usage) => {
      const display = displayParts(usage)
      return {
        id: modelKey(usage),
        provider: display.provider,
        modelName: display.modelName,
        totalCost: usage.totalCost,
        totalTokens: usage.totalTokens,
        totalRequests: usage.totalRequests,
      }
    })
    .sort((left, right) => right.totalCost - left.totalCost)

const modelKey = (usage: ModelUsage): string =>
  usage.provider === null ? usage.model : `${usage.provider}/${usage.model}`

const displayParts = (usage: ModelUsage): { provider: string; modelName: string } => {
  const segments = usage.model.split('/').filter((part) => part.length > 0)
  const modelName = segments.at(-1) ?? usage.model
  const providerRaw =
    usage.provider ??
    (segments.length >= 2 ? segments[0] : null) ??
    'Unknown'
  return {
    provider: titleCase(providerRaw),
    modelName,
  }
}

const budgetScopeLabel = (budget: Budget): string => {
  if (budget.sourceName !== null && budget.sourceName.length > 0) {
    return budget.sourceName
  }
  if (budget.sourceType !== null && budget.sourceType.length > 0) {
    return budget.sourceType
  }
  return 'Key budget'
}

const titleCase = (value: string): string => {
  if (value.length === 0) {
    return value
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
