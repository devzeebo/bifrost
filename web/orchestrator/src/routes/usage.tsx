import { createFileRoute } from '@tanstack/react-router'
import { BudgetPanel } from '../components/organisms/BudgetPanel'
import { ModelUsageCharts } from '../components/organisms/ModelUsageCharts'
import { ProviderBudgetPanel } from '../components/organisms/ProviderBudgetPanel'
import { QuotaIdentity } from '../components/organisms/QuotaIdentity'
import { RateLimitPanel } from '../components/organisms/RateLimitPanel'
import { PageLayout } from '../components/templates/PageLayout'
import { useVirtualKeyQuota } from '../usage/useVirtualKeyQuota'

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
          <BudgetPanel budgets={status.quota.budgets} />
          <RateLimitPanel
            rateLimit={status.quota.rateLimit}
            rateLimits={status.quota.rateLimits}
          />
          <ModelUsageCharts budgets={status.quota.budgets} />
          <ProviderBudgetPanel providers={status.quota.providerConfigs} />
        </>
      ) : null}
    </PageLayout>
  )
}

export const Route = createFileRoute('/usage')({
  component: UsagePage,
})
