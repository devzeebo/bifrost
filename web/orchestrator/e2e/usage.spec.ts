import { expect, test, type Page, type Route } from '@playwright/test'

test('usage page shows the active key and current-cycle spend', async ({ page }) => {
  await fulfillQuota(page, {
    virtualKeyName: 'orch-key',
    isActive: true,
    budgets: [
      {
        id: 'budget-1',
        maxLimit: 10,
        resetDuration: '1d',
        lastReset: '2026-11-08T00:00:00Z',
        currentUsage: 2.5,
        perModelUsage: [
          {
            model: 'gpt-4.1',
            provider: 'openai',
            totalRequests: 3,
            totalTokens: 1200,
            totalCost: 2.5,
          },
        ],
        sourceType: null,
        sourceId: null,
        sourceName: null,
      },
    ],
    rateLimit: null,
    rateLimits: [],
    providerConfigs: [],
    modelConfigs: [],
  })

  await page.goto('/usage')
  await expect(page.getByRole('heading', { name: 'Virtual key usage' })).toBeVisible()
  await expect(page.getByText('orch-key')).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
  await expect(page.getByText('$2.50')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Per-model usage' })).toBeVisible()
})

test('usage page shows an error when the quota proxy fails', async ({ page }) => {
  await page.route('**/get-virtual-key-quota', async (route) => {
    await route.abort()
  })
  await page.goto('/usage')
  await expect(page.getByText(/Failed to fetch|network|Orchestrator returned/i)).toBeVisible()
})

const fulfillQuota = async (page: Page, quota: unknown): Promise<void> => {
  await page.route('**/get-virtual-key-quota', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quota),
    })
  })
}
