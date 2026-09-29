import { expect, test, type Page, type Route } from '@playwright/test'

const nodeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

test('reachable poll shows the orchestrator and the worker', async ({ page }) => {
  await fulfillWorkers(page, [
    {
      id: nodeId,
      isAvailable: true,
      isOnline: true,
      lastHeartbeatAt: new Date().toISOString(),
    },
  ])
  await page.goto('/')
  await expect(page.getByText('Reachable', { exact: true })).toBeVisible()
  await expect(page.getByText('aaaaaaaa')).toBeVisible()
  await expect(page.getByText('Online', { exact: true })).toBeVisible()
  await expect(page.getByText('Available', { exact: true })).toBeVisible()
})

test('failed poll shows the orchestrator as unreachable', async ({ page }) => {
  await page.route('**/list-worker-nodes', async (route) => {
    await route.abort()
  })
  const poll = page.waitForRequest('**/list-worker-nodes')
  await page.goto('/')
  await poll
  await expect(page.getByText('Unreachable', { exact: true })).toBeVisible()
  await expect(page.getByText('Reachable', { exact: true })).toHaveCount(0)
})

test('empty worker list says none are registered', async ({ page }) => {
  await fulfillWorkers(page, [])
  await page.goto('/')
  await expect(page.getByText('Reachable', { exact: true })).toBeVisible()
  await expect(page.getByText('No worker nodes are registered.')).toBeVisible()
})

const fulfillWorkers = async (page: Page, workers: readonly WorkerNode[]): Promise<void> => {
  await page.route('**/list-worker-nodes', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(workers),
    })
  })
}

type WorkerNode = {
  readonly id: string
  readonly isAvailable: boolean
  readonly isOnline: boolean
  readonly lastHeartbeatAt: string | null
}
