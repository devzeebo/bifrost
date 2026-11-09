import { createFileRoute } from '@tanstack/react-router'
import { BudgetPanel, type ScopedBudget } from '../components/organisms/BudgetPanel'
import { ModelUsageCharts } from '../components/organisms/ModelUsageCharts'
import { ProviderBudgetPanel } from '../components/organisms/ProviderBudgetPanel'
import { QuotaIdentity } from '../components/organisms/QuotaIdentity'
import { RateLimitPanel, type ScopedRateLimit } from '../components/organisms/RateLimitPanel'
import { PageLayout } from '../components/templates/PageLayout'
import { useVirtualKeyQuota } from '../usage/useVirtualKeyQuota'
import type { Budget, RateLimit, VirtualKeyQuota } from '../usage/virtualKeyQuota'

const UsagePage = () => {
  const status = useVirtualKeyQuota()

  return (
    <PageLayout
      title="Virtual key usage"
      subtitle="Current-cycle budget, rate limits, and per-model usage for the active key."
      current="usage"
    >
      {status.kind === 'loading' ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">Loading quota…</p>
      ) : null}
      {status.kind === 'error' ? (
        <p className="border border-line bg-surface px-5 py-6 text-sm text-muted">{status.message}</p>
      ) : null}
      {status.kind === 'ready' ? (
        <>
          <QuotaIdentity quota={status.quota} />
          <BudgetPanel budgets={collectBudgets(status.quota)} />
          <RateLimitPanel limits={collectRateLimits(status.quota)} />
          <ModelUsageCharts budgets={collectChartBudgets(status.quota)} />
          <ProviderBudgetPanel providers={status.quota.providerConfigs} />
        </>
      ) : null}
    </PageLayout>
  )
}

const collectBudgets = (quota: VirtualKeyQuota): readonly ScopedBudget[] => [
  ...quota.budgets.map((budget) => withBudgetScope(budget, 'Key')),
  ...quota.providerConfigs.flatMap((provider) =>
    provider.budgets.map((budget) => withBudgetScope(budget, `Provider ${provider.provider}`)),
  ),
  ...quota.modelConfigs.flatMap((model) =>
    model.budgets.map((budget) =>
      withBudgetScope(
        budget,
        model.provider === null
          ? `Model ${model.modelName}`
          : `Model ${model.provider}/${model.modelName}`,
      ),
    ),
  ),
]

const collectRateLimits = (quota: VirtualKeyQuota): readonly ScopedRateLimit[] => {
  const limits: ScopedRateLimit[] = []
  const seen = new Set<string>()

  const push = (limit: RateLimit | null, scopeLabel: string) => {
    if (limit === null) {
      return
    }
    const key = `${scopeLabel}:${limit.id}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    limits.push({ ...limit, scopeLabel })
  }

  push(quota.rateLimit, 'Key')
  for (const limit of quota.rateLimits) {
    push(limit, limit.sourceName ?? limit.sourceType ?? 'Key')
  }
  for (const provider of quota.providerConfigs) {
    push(provider.rateLimit, `Provider ${provider.provider}`)
  }
  for (const model of quota.modelConfigs) {
    push(
      model.rateLimit,
      model.provider === null
        ? `Model ${model.modelName}`
        : `Model ${model.provider}/${model.modelName}`,
    )
  }

  return limits
}

const collectChartBudgets = (quota: VirtualKeyQuota): readonly Budget[] => [
  ...quota.budgets,
  ...quota.providerConfigs.flatMap((provider) => provider.budgets),
  ...quota.modelConfigs.flatMap((model) => model.budgets),
]

const withBudgetScope = (budget: Budget, scopeLabel: string): ScopedBudget => ({
  ...budget,
  scopeLabel,
})

export const Route = createFileRoute('/usage')({
  component: UsagePage,
})
