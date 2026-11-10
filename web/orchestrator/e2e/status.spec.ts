import { expect, test, type Page, type Route } from '@playwright/test'

const nodeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const pendingId = '11111111-1111-1111-1111-111111111111'
const heldId = '22222222-2222-2222-2222-222222222222'

test('reachable poll shows the orchestrator and the worker', async ({ page }) => {
  await fulfillCluster(page, {
    workers: [
      {
        id: nodeId,
        isAvailable: true,
        isOnline: true,
        lastHeartbeatAt: new Date().toISOString(),
      },
    ],
    pending: [],
    held: [],
  })
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
  await fulfillCluster(page, { workers: [], pending: [], held: [] })
  await page.goto('/')
  await expect(page.getByText('Reachable', { exact: true })).toBeVisible()
  await expect(page.getByText('No worker nodes are registered.')).toBeVisible()
})

test('shows pending queue and held work', async ({ page }) => {
  await fulfillCluster(page, {
    workers: [
      {
        id: nodeId,
        isAvailable: true,
        isOnline: true,
        lastHeartbeatAt: new Date().toISOString(),
      },
    ],
    pending: [{ id: pendingId, status: 'pending', holderId: null }],
    held: [{ id: heldId, status: 'claimed', holderId: nodeId }],
  })
  await page.goto('/')
  await expect(page.getByText('Pending queue')).toBeVisible()
  await expect(page.getByText('11111111')).toBeVisible()
  await expect(page.getByText('Held work')).toBeVisible()
  await expect(page.getByText('22222222')).toBeVisible()
})

const fulfillCluster = async (
  page: Page,
  data: {
    readonly workers: readonly WorkerNode[]
    readonly pending: readonly TrackedWorkItem[]
    readonly held: readonly TrackedWorkItem[]
  },
): Promise<void> => {
  await page.route('**/list-worker-nodes', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data.workers),
    })
  })
  await page.route('**/list-pending-tracked-work-items', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: data.pending }),
    })
  })
  await page.route('**/list-tracked-work-items-held-by/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: data.held }),
    })
  })
}

type WorkerNode = {
  readonly id: string
  readonly isAvailable: boolean
  readonly isOnline: boolean
  readonly lastHeartbeatAt: string | null
}

type TrackedWorkItem = {
  readonly id: string
  readonly status: string
  readonly holderId: string | null
}
